---
name: PDF.js browser compatibility
description: PDF.js modern builds can parse files but fail during rendering in supported browsers
---

Prefer PDF.js's bundled compatibility build and matching worker for browser-facing previews, rather than assuming the modern build works in every current browser.

**Why:** PDF.js 5.7 used `Map.prototype.getOrInsertComputed`, which was missing in the Chrome 140 test browser. Files loaded and page counts were correct, but every thumbnail failed during rendering. The bundled legacy build includes the needed polyfills.

**How to apply:** Keep the renderer and worker on matching builds. Verify actual page rendering, not only successful parsing or type-checking, when changing the PDF.js version or entry point. Avoid custom global polyfills when the package supplies a supported compatibility build.