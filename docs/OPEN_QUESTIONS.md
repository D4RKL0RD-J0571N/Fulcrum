# Fulcrum — Open Questions & Decision Log

This document records ambiguities, trade-offs, and assumptions made during design and development, alongside their verified resolutions.

---

## 1. Questions & Resolutions

### OQ-001: Manipulation Unit (MU) Dimensions and Physical Stacking Rules
- **Initial Ambiguity:** Can Manipulation Units have arbitrary physical dimensions (height, width) that dictate how many fit on a platform, or is capacity strictly count-based?
- **Resolution (Implemented & Verified in M4–M8):** 
  - Standard rack shelf locations contain **2 platforms** (`plat_1` and `plat_2`).
  - Each platform holds **9 Manipulation Units (MUs)** organized in three layers of 3, resulting in **18 boxes per rack level** across the two platforms.
  - MUs are tracked by 6-digit alphanumeric codes (e.g., `502900`, `101003`).
  - Each MU contains packs of 5 to 6 units per sequential size variant (e.g. S, M, L).
  - Volumetric and weight thresholds are verified in domain invariants, with physical extraction penalties (18s ground tier, 25s inner cage shuffle) applied in simulation.

### OQ-002: Forklift Congestion Slowdown vs. Complete Bay Lockout
- **Initial Ambiguity:** When a forklift executes a high-level replenishment in a bay, does it completely block manual pickers from entering the bay, or does it apply a velocity slowdown penalty?
- **Resolution (Implemented & Verified in M4–M8):**
  - High-tier replenishment (Level D) triggers a complete bay lockout (`forklift_lockout_duration_seconds`, 180s). During this time, manual pickers cannot enter the bay.
  - In addition, Level A ground-tier manual picks incur an 18s platform extraction delay, and buried inner boxes incur a 25s cage shuffle delay.
  - Strategy 4a (Batch-Wave Grouping) groups demand for co-located MUs, eliminating redundant visits and bypassing peak forklift congestion windows.

### OQ-003: Monorepo Package Management & Tooling
- **Initial Ambiguity:** Should Phase A and B use pnpm workspaces, npm workspaces, or Turborepo?
- **Resolution (Implemented & Verified in M2–M8):**
  - Standard npm workspaces configured with zero proprietary daemon overhead.
  - Workspaces: `apps/web`, `packages/contracts`, `packages/domain`, `packages/persistence`, `packages/sim-engine`.
  - Additional worker: `workers/sim-worker` (.NET 9 C# solution).
  - Unified commands: `npm run test`, `npm run dev`, `npm run build`, `dotnet test ...`.

### OQ-004: Visual Reference Image Discrepancies
- **Initial Ambiguity:** The initial visual reference image contained minor inconsistencies (e.g., stray "80" axis label, mixing "Row EA" and "Row EH", repetitive "A-C" level labels).
- **Resolution (Implemented & Verified in M5):**
  - Derived all axis labels and row geometry directly from the active `WarehouseLayoutConfig`.
  - Rendered explicit level breakdowns (A: Ground/Manual, B: Mid/Manual, C: Top/Manual, D: Forklift-only) with clear access indicators.
  - Implemented 2D top-down plan view with real-time heatmaps and a slide-out rack elevation drawer.
  - Bound all percentages, travel distances, and pick times to genuine deterministic simulation runs.

---

## 2. Decision Record Summary

All major architectural decisions are formally documented in Architecture Decision Records (`docs/ADR/`):
- **ADR-001**: Simulation Engine Boundary (Zod snapshot contracts, engine separation)
- **ADR-002**: Layout as Versioned Configuration
- **ADR-003**: Fixed Segment Order (v1)
- **ADR-004**: Inventory as Append-Only Ledger
- **ADR-005**: 2D Plan View vs 3D WebGL
- **ADR-006**: In-Memory Repositories for Phase A Showcase
