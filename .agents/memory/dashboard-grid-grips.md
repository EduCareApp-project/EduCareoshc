---
name: Dashboard grid resize grips
description: Styling precedence for the dashboard's third-party drag/resize controls.
---

When styling the dashboard's resize grips, use selectors more specific than the grid library's item-to-handle directional rules; a simple class rule can appear correct in source but leave the grip rotated.

**Why:** The library's directional CSS won over a local `transform: none`, leaving large diagonal bars and misleading South/East hit areas. Removing the grip image alone did not fix it. A browser check of computed transforms and handle rectangles identified the actual conflict.

**How to apply:** Keep edge grips axis-aligned and check their computed transforms and dimensions after any grid or stylesheet change, not just a screenshot of the tile.
