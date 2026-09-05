# Spring

Spring is a small language inspired by Swift, built for one purpose: to be
**readable**. It transpiles to plain JavaScript, so it targets the web.

Swift is a great language, but it leans on short, symbol-heavy syntax —
`{ }`, `VStack`, `var`/`let` — that reads fine once you already know it and
opaque before that. Spring makes the opposite trade: it spells things out.

```swift
// Swift
VStack {
    Text("Hello")
    Button("Tap me") { print("tapped") }
}
```

```
// Spring
vertical.stack out
    text("Hello")
    button("Tap me") action: out
        print("tapped")
    out
out
```

Same idea, no punctuation to memorize.

## Design rules

1. **No `{ }` for blocks.** Every block — a function body, an `if`, a loop,
   a UI tree — is closed with the keyword `out` instead of a closing brace.
   Nothing opens a block with a symbol either; the block just starts on the
   next line after the statement that introduces it.
2. **Long, literal names instead of abbreviations.** Swift/SwiftUI's
   `VStack` and `HStack` become `vertical.stack` and `horizontal.stack`.
   `var`/`let` become `variable`/`constant`. If a keyword can be a whole
   word instead of an abbreviation, Spring uses the whole word.
3. **Dotted words are just words.** `vertical.stack`, `for.each`, and
   `repeat.while` are single keywords written with a dot, and ordinary
   member access (`list.count`, `user.name`) reads exactly the same way —
   there's only one naming pattern to learn.
4. **Spring compiles to readable JavaScript.** The output isn't minified or
   obfuscated; you can open the `.js` file and see your program.

## Syntax at a glance

| Spring | Compiles to |
|---|---|
| `constant x = 1` | `const x = 1;` |
| `variable x = 1` | `let x = 1;` |
| `function name(a, b) out ... out` | `function name(a, b) { ... }` |
| `if cond out ... otherwise out ... out` | `if (cond) { ... } else { ... }` |
| `repeat.while cond out ... out` | `while (cond) { ... }` |
| `for.each item in list out ... out` | `for (const item of list) { ... }` |
| `return value` | `return value;` |
| `"Hi \(name)"` | `` `Hi ${name}` `` |
| `vertical.stack out ... out` | `stack("vertical", [...])` |
| `horizontal.stack out ... out` | `stack("horizontal", [...])` |
| `text("...")` | `text("...")` (runtime call) |
| `button("Label") action: out ... out` | `button("Label", function(){ ... })` |

Everything else — arithmetic, function calls, arrays (`[1, 2, 3]`), string
literals, comparisons (`==`, `>=`, `&&`, `||`) — is passed straight through,
since it already reads fine.

## Project layout

```
spring-lang/
  bin/springc.js       CLI: springc file.spring [-o out.js]
  src/lexer.js         Tokenizer
  src/parser.js        Parser + JS code generator (the actual compiler)
  src/runtime.js        Browser/Node runtime for print/text/button/stack
  examples/            hello.spring, ui-demo.spring, and a playground.html
  test/run.js          A small hand-written test suite
```

## Try it

```bash
npm test                     # run the test suite
node bin/springc.js examples/hello.spring          # print compiled JS
node bin/springc.js examples/hello.spring -o out.js # write it to a file
```

To see the UI demo in a browser, open `examples/playground.html` — it loads
`src/runtime.js` and the compiled `ui-demo.spring` and renders it live.

If you can install packages globally:

```bash
npm link
springc examples/hello.spring
```

## Example: `hello.spring`

```
function classify(score) out
    if score >= 90 out
        return "A"
    otherwise out
        return "B or lower"
    out
out

variable total = 0
for.each n in [1, 2, 3, 4, 5] out
    total = total + n
out
print("Total is \(total)")
print(classify(95))
```

## What's here vs. what's next (v0.1)

This is a working MVP transpiler, not a full language yet. It currently
supports: `constant`/`variable`, `function`, `if`/`otherwise`, `repeat.while`,
`for.each`, `return`, string interpolation, and the `vertical.stack` /
`horizontal.stack` / `text` / `button` UI builders, with expressions passed
through as JavaScript. Not yet implemented: a real type system (type
annotations are currently parsed and discarded), pattern matching,
classes/structs, modules/imports, and a source map from compiled JS back to
`.spring` source. Contributions welcome — see `src/parser.js`, which is
intentionally written as one readable file per concern (lexer, parser,
runtime) so it's easy to extend.

## License

MIT — see `LICENSE`.
