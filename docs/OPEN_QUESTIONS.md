# Fulcrum — Open Questions & Decision Log

This document records ambiguities, trade-offs, and assumptions made during design and development.
Per standing rules: *If a requirement is ambiguous, record it in `docs/OPEN_QUESTIONS.md`, choose the most conservative assumption, and continue.*

---

## 1. Open Questions & Conservative Assumptions

### OQ-001: Manipulation Unit (MU) Dimensions and Physical Stacking Rules
- **Ambiguity:** Can Manipulation Units have arbitrary physical dimensions (height, width) that dictate how many fit on a platform, or is capacity strictly count-based?
- **Conservative Assumption:** For Phase A, platform capacity is modeled as an integer unit limit (default 2 MUs per platform, default 2 platforms per location, with overrides per row/bay). "6-9 boxes in layers of 3" is treated as an informative seed configuration and UI visualization hint, not a continuous volumetric bin-packing constraint.
- **Impact:** Simpler, robust deterministic validation in Phase A. 3D volumetric bounding box packing is deferred to Phase B.

### OQ-002: Forklift Congestion Slowdown vs. Complete Bay Lockout
- **Ambiguity:** When a forklift executes a high-level replenishment in a bay, does it completely block manual pickers from entering the bay, or does it apply a velocity slowdown penalty?
- **Conservative Assumption:** The engine models a complete lockout duration (`forklift_lockout_duration_seconds`, default 180s) during active pallet insertion, during which manual pick tasks in that exact bay are blocked. If a picker is already in the bay, they must finish or wait. A configurable slowdown factor is also available for adjacent bays.
- **Impact:** Creates clear, observable contention spikes in simulation metrics that clearly illustrate the benefits of the congestion-aware strategy.

### OQ-003: Monorepo Package Management & Tooling
- **Ambiguity:** Should Phase A use pnpm workspaces, npm workspaces, or Turborepo?
- **Conservative Assumption:** Use standard npm workspaces or pnpm with Turborepo for lightweight, zero-overhead TypeScript project references. Keep scripts (`npm run build`, `npm run test`, `npm run lint`) uniform at the root.
- **Impact:** Runs cleanly across all developer environments on Windows, Linux, and macOS without requiring proprietary build daemon setups.

### OQ-004: Visual Reference Image Discrepancies
- **Ambiguity:** The visual reference image contains minor inconsistencies (e.g., stray "80" axis label, mixing "Row EA" and "Row EH", repetitive "A-C" level labels).
- **Conservative Assumption:** Address all 8 specific discrepancies noted in Section 8 of the project requirements: derive all axis labels strictly from the active layout, render each configured level explicitly from top to bottom with access indicators, use a 2D top-down plan view with rack elevation drawer rather than isometric 3D, and bind all percentages to real simulation runs.
- **Impact:** Prevents confusing UI bugs and aligns the interface with genuine operational warehouse standards.
