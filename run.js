"use strict";

const assert = require("assert");
const { transpile } = require("../src/parser");

let passed = 0;
function check(name, spring, expectedFragments) {
  const js = transpile(spring);
  for (const fragment of expectedFragments) {
    assert.ok(
      js.includes(fragment),
      `[${name}] expected output to include:\n  ${fragment}\ngot:\n${js}`
    );
  }
  passed++;
  console.log(`ok - ${name}`);
}

check("constant/variable", `constant x = 1\nvariable y = 2`, [
  "const x = 1;",
  "let y = 2;",
]);

check("function + return", `function add(a, b) out\n  return a + b\nout`, [
  "function add(a, b) {",
  "return a + b;",
  "}",
]);

check("if/otherwise", `if x > 0 out\n  print("pos")\notherwise out\n  print("neg")\nout`, [
  'if (x > 0) {',
  'print("pos");',
  "} else {",
  'print("neg");',
]);

check("for.each", `for.each n in [1, 2, 3] out\n  print(n)\nout`, [
  "for (const n of [1, 2, 3]) {",
  "print(n);",
]);

check("repeat.while", `repeat.while n > 0 out\n  print(n)\nout`, [
  "while (n > 0) {",
  "print(n);",
]);

check("string interpolation", `print("Hi \\(name)!")`, [
  "print(`Hi ${name}!`);",
]);

check("plain string stays a string literal", `constant s = "hello"`, [
  'const s = "hello";',
]);

check("vertical.stack / horizontal.stack / text / button", `
constant view = vertical.stack out
    text("hi")
    button("go") action: out
        print("tapped")
    out
out
`, [
  'stack("vertical", [text("hi"), button("go", function() {',
  'print("tapped");',
  "})]);",
]);

console.log(`\n${passed} test(s) passed.`);
