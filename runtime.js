/**
 * Spring runtime.
 *
 * Transpiled Spring code calls plain functions named print / text / button /
 * stack. This file is what makes those functions do something. Load it
 * before your compiled .js file in the browser, or `require` it in Node.
 *
 *   <script src="spring-runtime.js"></script>
 *   <script src="app.js"></script>
 */
(function (root) {
  "use strict";

  function print(...args) {
    console.log(...args);
  }

  // A "view" is a plain object describing an element. stack()/text()/button()
  // build these; mount() turns a view tree into real DOM nodes.
  function text(value) {
    return { kind: "text", value: String(value) };
  }

  function button(label, onClick) {
    return { kind: "button", label: String(label), onClick: onClick || function () {} };
  }

  function stack(direction, children) {
    return { kind: "stack", direction: direction === "horizontal" ? "horizontal" : "vertical", children: children || [] };
  }

  function render(view) {
    if (view == null) return document.createTextNode("");
    if (view.kind === "text") {
      const el = document.createElement("span");
      el.className = "spring-text";
      el.textContent = view.value;
      return el;
    }
    if (view.kind === "button") {
      const el = document.createElement("button");
      el.className = "spring-button";
      el.textContent = view.label;
      el.addEventListener("click", view.onClick);
      return el;
    }
    if (view.kind === "stack") {
      const el = document.createElement("div");
      el.className = "spring-stack spring-stack-" + view.direction;
      el.style.display = "flex";
      el.style.flexDirection = view.direction === "horizontal" ? "row" : "column";
      el.style.gap = "8px";
      view.children.forEach((child) => el.appendChild(render(child)));
      return el;
    }
    // Unknown value: render as text so mistakes are visible, not silent.
    const el = document.createElement("span");
    el.textContent = String(view);
    return el;
  }

  // mount(view, "#app") or mount(view, document.getElementById('app'))
  function mount(view, target) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) throw new Error("Spring: mount target not found: " + target);
    el.innerHTML = "";
    el.appendChild(render(view));
  }

  const api = { print, text, button, stack, render, mount };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) {
    Object.assign(root, api);
  }
})(typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : this);
