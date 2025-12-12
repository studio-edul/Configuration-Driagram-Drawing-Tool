## Connection Routing (Non-overlapping Lanes)

This project renders connection lines as orthogonal (Manhattan) polylines.

### Goals
- Avoid overlapping connection lines when one source connects to multiple targets.
- Avoid routes that visually go "inside" boxes when source/target X positions are close (vertical-ish alignment).

### Terminology
- **Source**: connection start node (conn.source)
- **Target**: connection end node (conn.target)
- **Start anchor**: point on a node's side where the line starts
- **End anchor**: point on a node's side where the line ends
- **Lane**: a dedicated X-coordinate (`laneX`) used for the vertical segment of a connection

### Case A: Normal horizontal gap (default)
If there is sufficient horizontal gap between source and target:
- Start: **source RIGHT**
- End: **target LEFT**

Route shape:
1) start (on source right) -> short stub outward
2) horizontal to `laneX`
3) vertical to target Y
4) horizontal to target left (approach), then end

### Case B: Near-X / vertical-ish alignment (requested behavior)
When the source/target X positions are close (or overlap in X), the old right->left logic
would route through/inside boxes.

In this case:
- Start: **source RIGHT**
- End: **target RIGHT**

Route shape:
1) start (on source right) -> short stub outward
2) horizontal to `laneX` (placed to the **right** of both nodes)
3) vertical to target Y
4) horizontal back to target right (approach), then end

### How overlapping is avoided
For each source node, connections are grouped by `(sourceId, routeType)` and sorted by `targetY`.
Each connection gets its own lane:
- `laneX_i = baseX + i * laneGap`

This guarantees the primary vertical segments do not overlap.

### Where this is implemented
- `src/core/Visualizer.js`
  - `calculateConnectionLayout()` (current)
  - `calculateConnectionLayoutLegacy()` (archive)

### Bend order
Current behavior in `buildLaneRoutedPath()`:
- Horizontal → Vertical (fixed)


