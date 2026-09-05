"use strict";

/**
 * Spring language lexer.
 *
 * Turns source text into a flat token stream. Design choices that matter
 * for the rest of the pipeline:
 *
 *  - Identifiers may contain dots ("vertical.stack", "for.each",
 *    "list.filter"). This is what lets Spring use long, readable,
 *    dotted keywords while still letting normal member access
 *    ("myList.count") read the exact same way.
 *  - Strings support Swift-style interpolation: "Hello \(name)" becomes
 *    a token whose `parts` field alternates literal / expression chunks.
 *  - Newlines are kept as real tokens because Spring has no semicolons
 *    or braces -- a newline is often the only thing that ends a
 *    statement or a UI child element.
 */

const MULTI_CHAR_PUNCT = [
  "==", "!=", "<=", ">=", "&&", "||", "->",
  "+=", "-=", "*=", "/=", "...",
];

function isIdentStart(ch) {
  return /[A-Za-z_]/.test(ch);
}
function isIdentPart(ch) {
  return /[A-Za-z0-9_]/.test(ch);
}
function isDigit(ch) {
  return /[0-9]/.test(ch);
}

function tokenize(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  const n = source.length;

  function push(type, value, extra) {
    tokens.push(Object.assign({ type, value, line }, extra || {}));
  }

  while (i < n) {
    const ch = source[i];

    // Newlines are significant.
    if (ch === "\n") {
      push("newline", "\n");
      i++;
      line++;
      continue;
    }

    // Other whitespace is not.
    if (ch === " " || ch === "\t" || ch === "\r") {
      i++;
      continue;
    }

    // Line comments.
    if (ch === "/" && source[i + 1] === "/") {
      while (i < n && source[i] !== "\n") i++;
      continue;
    }

    // Strings, with \( ... \) interpolation.
    if (ch === '"') {
      const startLine = line;
      i++; // consume opening quote
      const parts = []; // { kind: 'lit'|'expr', value: string }
      let lit = "";
      while (i < n && source[i] !== '"') {
        if (source[i] === "\\" && source[i + 1] === "(") {
          // interpolation: \( expr )
          if (lit) { parts.push({ kind: "lit", value: lit }); lit = ""; }
          i += 2;
          let depth = 1;
          let expr = "";
          while (i < n && depth > 0) {
            if (source[i] === "(") depth++;
            if (source[i] === ")") {
              depth--;
              if (depth === 0) { i++; break; }
            }
            expr += source[i];
            i++;
          }
          parts.push({ kind: "expr", value: expr });
          continue;
        }
        if (source[i] === "\\" && source[i + 1] === '"') {
          lit += '"';
          i += 2;
          continue;
        }
        if (source[i] === "\\" && source[i + 1] === "n") {
          lit += "\n";
          i += 2;
          continue;
        }
        if (source[i] === "\n") line++;
        lit += source[i];
        i++;
      }
      if (lit) parts.push({ kind: "lit", value: lit });
      i++; // consume closing quote
      push("string", null, { parts, line: startLine });
      continue;
    }

    // Numbers.
    if (isDigit(ch)) {
      let start = i;
      while (i < n && isDigit(source[i])) i++;
      if (source[i] === "." && isDigit(source[i + 1])) {
        i++;
        while (i < n && isDigit(source[i])) i++;
      }
      push("number", source.slice(start, i));
      continue;
    }

    // Identifiers / dotted keywords.
    if (isIdentStart(ch)) {
      let start = i;
      i++;
      while (i < n && isIdentPart(source[i])) i++;
      // allow dotted continuation: word.word.word ...
      while (
        source[i] === "." &&
        isIdentStart(source[i + 1] || "")
      ) {
        i++;
        while (i < n && isIdentPart(source[i])) i++;
      }
      push("word", source.slice(start, i));
      continue;
    }

    // Multi-char punctuation.
    const two = source.slice(i, i + 3);
    const twoShort = source.slice(i, i + 2);
    if (MULTI_CHAR_PUNCT.includes(two)) {
      push("punct", two);
      i += 3;
      continue;
    }
    if (MULTI_CHAR_PUNCT.includes(twoShort)) {
      push("punct", twoShort);
      i += 2;
      continue;
    }

    // Single-char punctuation / operators.
    push("punct", ch);
    i++;
  }

  push("eof", null);
  return tokens;
}

module.exports = { tokenize };
