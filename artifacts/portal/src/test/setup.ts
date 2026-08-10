import "@testing-library/jest-dom";

// Radix UI (Select, DropdownMenu, etc.) calls pointer-capture APIs that jsdom
// does not implement. Stub them so tests can interact with those components.
if (typeof window !== "undefined") {
  window.HTMLElement.prototype.hasPointerCapture = function () { return false; };
  window.HTMLElement.prototype.setPointerCapture = function () {};
  window.HTMLElement.prototype.releasePointerCapture = function () {};
  // scrollIntoView is also missing in jsdom but called by Radix Select.
  window.HTMLElement.prototype.scrollIntoView = function () {};
}
