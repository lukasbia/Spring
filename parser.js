"use strict";

const { tokenize } = require("./lexer");

const NO_SPACE_BEFORE = new Set([",", ")", "]", ".", ":", ";", "("]);
const NO_SPACE_AFTER = new Set(["(", "[", "."]);

class ParseError extends Error {
  constructor(msg, line) {
    super(`Spring syntax error (line ${line}): ${msg}`);
  }
}

class Parser {
  constructor(source) {
    this.tokens = tokenize(source);
    this.pos = 0;
  }

  peek(offset = 0) {
    return this.tokens[this.pos + offset];
  }

  next() {
    return this.tokens[this.pos++];
  }

  atWord(value) {
    const t = this.peek();
    return t.type === "word" && t.value === value;
  }

  atPunct(value) {
    const t = this.peek();
    return t.type === "punct" && t.value === value;
  }

  skipNewlines() {
    while (this.peek().type === "newline") this.pos++;
  }

  expectWord(value) {
    const t = this.next();
    if (t.type !== "word" || t.value !== value) {
      throw new ParseError(`expected "${value}" but found "${t.value}"`, t.line);
    }
    return t;
  }

  expectPunct(value) {
    const t = this.next();
    if (t.type !== "punct" || t.value !== value) {
      throw new ParseError(`expected "${value}" but found "${t.value}"`, t.line);
    }
    return t;
  }

  // ---- string interpolation -> JS string / template literal -------------
  stringToJs(tok) {
    const hasInterpolation = tok.parts.some((p) => p.kind === "expr");
    if (!hasInterpolation) {
      const raw = tok.parts.length ? tok.parts[0].value : "";
      return JSON.stringify(raw);
    }
    const inner = tok.parts
      .map((p) => {
        if (p.kind === "lit") {
          return p.value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
        }
        // sub-expression: recursively transpile it as a standalone expression
        const sub = new Parser(p.value);
        const js = sub.parseExpressionUntil([]);
        return "${" + js + "}";
      })
      .join("");
    return "`" + inner + "`";
  }

  // ---- generic "raw" expression capture ----------------------------------
  // Reads tokens until, at paren/bracket depth 0, we hit EOF, a newline,
  // or a word in `enders`. Recognizes the handful of Spring constructs
  // that use the `out` block-closer (vertical.stack / horizontal.stack /
  // button(...) action:) wherever they appear, so they work equally well
  // as statements, return values, or variable initializers.
  parseExpressionUntil(enders) {
    const pieces = [];
    let depth = 0;
    let lastWasOpenish = true; // controls leading space suppression

    const emit = (text, noSpaceBefore, noSpaceAfter) => {
      if (pieces.length && !noSpaceBefore && !lastWasOpenish) pieces.push(" ");
      pieces.push(text);
      lastWasOpenish = !!noSpaceAfter;
    };

    while (true) {
      const t = this.peek();

      if (t.type === "eof") break;

      if (t.type === "newline") {
        if (depth > 0) { this.pos++; continue; }
        this.pos++; // consume the terminating newline
        break;
      }

      if (depth === 0 && t.type === "word" && enders.includes(t.value)) {
        break;
      }

      if (t.type === "word" && (t.value === "vertical.stack" || t.value === "horizontal.stack")) {
        emit(this.parseStackExpr(), false, false);
        continue;
      }

      if (t.type === "word" && t.value === "button" && this.peek(1) && this.peek(1).type === "punct" && this.peek(1).value === "(") {
        emit(this.parseButtonExpr(), false, false);
        continue;
      }

      if (t.type === "string") {
        this.pos++;
        emit(this.stringToJs(t), false, false);
        continue;
      }

      if (t.type === "punct") {
        if (t.value === "(" || t.value === "[") depth++;
        if (t.value === ")" || t.value === "]") depth--;
        this.pos++;
        emit(t.value, NO_SPACE_BEFORE.has(t.value), NO_SPACE_AFTER.has(t.value));
        continue;
      }

      // word or number: emitted verbatim
      this.pos++;
      emit(t.value, false, false);
    }

    return pieces.join("");
  }

  // vertical.stack out  <children...>  out   ->   stack('vertical', [ ... ])
  parseStackExpr() {
    const head = this.next(); // "vertical.stack" | "horizontal.stack"
    const direction = head.value.split(".")[0];
    this.expectWord("out");
    const children = [];
    while (true) {
      this.skipNewlines();
      if (this.atWord("out")) break;
      if (this.peek().type === "eof") {
        throw new ParseError(`unterminated ${head.value} block (missing "out")`, head.line);
      }
      const child = this.parseExpressionUntil([]);
      if (child.trim() !== "") children.push(child);
    }
    this.expectWord("out");
    return `stack("${direction}", [${children.join(", ")}])`;
  }

  // button("Label") action: out <statements> out  ->  button("Label", function(){ ... })
  parseButtonExpr() {
    this.next(); // "button"
    this.expectPunct("(");
    const label = this.captureUntilTopLevel([")"]);
    this.expectPunct(")");
    this.expectWord("action");
    this.expectPunct(":");
    this.expectWord("out");
    const body = this.parseBlockStatements(["out"]);
    this.expectWord("out");
    return `button(${label}, function() {\n${indent(body).join("\n")}\n})`;
  }

  // ---- statement-level block parsing --------------------------------------
  parseBlockStatements(enders) {
    const lines = [];
    while (true) {
      this.skipNewlines();
      const t = this.peek();
      if (t.type === "eof") break;
      if (t.type === "word" && enders.includes(t.value)) break;
      lines.push(...this.parseStatement());
    }
    return lines;
  }

  parseStatement() {
    const t = this.peek();

    if (t.type === "word") {
      switch (t.value) {
        case "function": return this.parseFunction();
        case "constant": return this.parseVarDecl("const");
        case "variable": return this.parseVarDecl("let");
        case "if": return this.parseIf();
        case "repeat.while": return this.parseWhile();
        case "for.each": return this.parseForEach();
        case "return": return this.parseReturn();
        default: break;
      }
    }

    // fallback: expression statement (print(...), assignments, calls, UI trees, ...)
    const expr = this.parseExpressionUntil(["out", "otherwise"]);
    if (expr.trim() === "") return [];
    return [`${expr};`];
  }

  parseFunction() {
    this.expectWord("function");
    const name = this.next().value;
    this.expectPunct("(");
    const params = this.parseParamListSimple();
    this.expectPunct(")");
    // optional "-> ReturnType" is ignored
    if (this.atPunct("->")) {
      this.next();
      this.next();
    }
    this.expectWord("out");
    const body = this.parseBlockStatements(["out"]);
    this.expectWord("out");
    return [`function ${name}(${params}) {`, ...indent(body), `}`];
  }

  // Simpler, robust param list: name[: Type][ = default], comma separated,
  // default captured up to the next top-level comma or the closing paren.
  parseParamListSimple() {
    const params = [];
    while (!this.atPunct(")")) {
      const name = this.next().value;
      let def = null;
      if (this.atPunct(":")) {
        this.next();
        this.next(); // skip a single-token type annotation
      }
      if (this.atPunct("=")) {
        this.next();
        def = this.captureUntilTopLevel([",", ")"]);
      }
      params.push(def !== null ? `${name} = ${def}` : name);
      if (this.atPunct(",")) this.next();
    }
    return params.join(", ");
  }

  // Captures raw JS text until (at depth 0) one of the given punctuation
  // values is next, WITHOUT consuming it. Used for default parameter values.
  captureUntilTopLevel(stopPuncts) {
    const pieces = [];
    let depth = 0;
    while (true) {
      const t = this.peek();
      if (t.type === "eof") break;
      if (depth === 0 && t.type === "punct" && stopPuncts.includes(t.value)) break;
      if (t.type === "string") {
        this.pos++;
        pieces.push(this.stringToJs(t));
        continue;
      }
      if (t.type === "punct" && (t.value === "(" || t.value === "[")) depth++;
      if (t.type === "punct" && (t.value === ")" || t.value === "]")) depth--;
      this.pos++;
      pieces.push(t.value === "\n" ? "" : t.value);
    }
    return pieces.join(" ");
  }

  parseVarDecl(jsKeyword) {
    const t = this.next(); // constant | variable
    const name = this.next().value;
    if (this.atPunct(":")) { this.next(); this.next(); } // skip type annotation
    this.expectPunct("=");
    const expr = this.parseExpressionUntil(["out", "otherwise"]);
    return [`${jsKeyword} ${name} = ${expr};`];
  }

  parseIf() {
    this.expectWord("if");
    const cond = this.parseExpressionUntil(["out"]);
    this.expectWord("out");
    const thenBody = this.parseBlockStatements(["otherwise", "out"]);
    const lines = [`if (${cond}) {`, ...indent(thenBody)];
    if (this.atWord("otherwise")) {
      this.next();
      this.expectWord("out");
      const elseBody = this.parseBlockStatements(["out"]);
      this.expectWord("out");
      lines.push("} else {", ...indent(elseBody), "}");
    } else {
      this.expectWord("out");
      lines.push("}");
    }
    return lines;
  }

  parseWhile() {
    this.expectWord("repeat.while");
    const cond = this.parseExpressionUntil(["out"]);
    this.expectWord("out");
    const body = this.parseBlockStatements(["out"]);
    this.expectWord("out");
    return [`while (${cond}) {`, ...indent(body), `}`];
  }

  parseForEach() {
    this.expectWord("for.each");
    const itemName = this.next().value;
    this.expectWord("in");
    const coll = this.parseExpressionUntil(["out"]);
    this.expectWord("out");
    const body = this.parseBlockStatements(["out"]);
    this.expectWord("out");
    return [`for (const ${itemName} of ${coll}) {`, ...indent(body), `}`];
  }

  parseReturn() {
    this.expectWord("return");
    const expr = this.parseExpressionUntil(["out", "otherwise"]);
    return expr.trim() === "" ? ["return;"] : [`return ${expr};`];
  }

  parseProgram() {
    const lines = this.parseBlockStatements([]);
    return lines.join("\n");
  }
}

function indent(lines) {
  return lines.map((l) => "  " + l.split("\n").join("\n  "));
}

function transpile(source) {
  const parser = new Parser(source);
  return parser.parseProgram();
}

module.exports = { Parser, transpile, ParseError };
