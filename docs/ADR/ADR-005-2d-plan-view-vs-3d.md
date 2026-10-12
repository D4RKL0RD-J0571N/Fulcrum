# ADR-005: 2D Plan View with Rack Elevation Drill-Down vs. Isometric 3D

## Status
Accepted

## Context
Industrial warehouse interfaces sometimes attempt isometric 3D or WebGL visualizations. While visually striking in marketing materials, full 3D environments suffer from occlusion (racks hiding other racks), high rendering overhead, poor battery performance on mobile/tablets, awkward camera controls, and lack of clarity during rapid operational decision-making. The visual reference image used an isometric render with several labeling and orientation flaws.

## Decision
1. For Phase A and standard production workflows, Fulcrum adopts a high-density **2D Top-Down Plan View** combined with a **Vertical Rack Elevation Drill-Down Drawer**.
2. The plan view renders racks as parallel strips with bays colored by heatmap metrics (occupancy, congestion, pick frequency).
3. Selecting any bay opens the right drawer displaying the exact vertical rack elevation (levels from top to bottom) with access badges (`[M]` Manual vs `[F]` Forklift) and platform slots.
4. Rendered using scalable, high-performance SVG or Canvas, avoiding heavy WebGL dependencies.
5. True 3D digital-twin visualization is deferred to an optional later enhancement.

## Consequences
- **Positive:** Zero occlusion: every bay is directly visible and clickable simultaneously.
- **Positive:** Exceptional performance rendering 2,000+ locations smoothly on any standard browser.
- **Positive:** Clean, accessible keyboard navigation and deep linking (`?loc=EH14D`).
- **Negative:** Does not visually resemble a photorealistic 3D game engine, but aligns with industrial operations control towers.
