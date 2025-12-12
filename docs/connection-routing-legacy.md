## Connection Routing (Legacy Archive)

This document describes the previous connection routing logic kept in code as:
- `Visualizer.calculateConnectionLayoutLegacy()`

### Legacy approach (high level)
1) **Determine sides** using strict left/right based on `dx` (center X):
   - target on right => source RIGHT, target LEFT
   - target on left  => source LEFT, target RIGHT

2) **Distribute ports** along the chosen sides:
   - multiple connections on the same side are given different offsets
   - this creates multiple “stubs” on the node boundary

3) **Compute Manhattan route** using a generic midpoint-based orthogonal path:
   - start -> buffered point (outward) -> intermediate bends -> buffered end -> end

4) **Post-process separation**:
   - collect vertical segments that share the same X
   - spread them by shifting X using a fixed gap

### Why it was replaced
- In “near-X” situations (nodes vertically aligned or with small horizontal gap),
  strict left/right assignment often routed lines visually through/inside boxes.
- With multiple vertically stacked targets, the legacy path separation could still
  produce overlaps or visually undesirable bundling.

### Reference
- Implementation: `src/core/Visualizer.js`
  - `calculateConnectionLayoutLegacy()`
  - `determineConnectionSides()`
  - `calculateManhattanRoute()`
  - `applyPathSeparation()`


