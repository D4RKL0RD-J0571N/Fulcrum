# Fulcrum — Product Specification

## 1. Executive Summary

**Fulcrum** is a simulation-first, AI-assisted warehouse fulfillment optimization platform. Unlike standard inventory and warehouse management systems (WMS/IMS) that act merely as transactional CRUD databases, Fulcrum provides an extensible operational domain model coupled with a deterministic discrete-event simulation engine.

Fulcrum evaluates fulfillment strategies, resource dispatch schedules, and inventory placement against configurable business constraints, presenting measurable, verifiable trade-offs to operations managers and planners.

---

## 2. Core Value Propositions

1. **Zero Guesswork / No Fabricated Metrics:** Every KPI delta (travel distance, order cycle time, bay congestion, picker utilization) is calculated from deterministic event simulation against immutable snapshots.
2. **Fully Configurable Spatial Layout:** No hard-coded warehouse assumptions. Any number of sides, rows, bays, levels, access restrictions, or physical dimensions can be modeled and dynamically generated.
3. **Auditable State & Ledger:** Inventory is tracked as an append-only transaction ledger with atomic reservations, guaranteeing zero phantom stock or race conditions.
4. **Governed AI Decision Assistance:** AI models propose plans with verifiable entity-level evidence. Model proposals never mutate operational state without simulation verification, human review, and explicit approval.

---

## 3. Product Scope & Functional Requirements

### 3.1 Warehouse Topography & Dynamic Configuration
- **Dynamic Hierarchy:** `Warehouse -> Side/Zone (optional) -> Row -> Column (Bay) -> Level -> Location -> Platform -> Manipulation Unit (MU) -> Material (SKU, quantity, lot, status)`.
- **Template-Driven Addressing:** Configurable code formatting (e.g. `[side?][row][column][level]` with customizable prefixes, numbering schemes, and separators).
- **Physical Coordinates:** Explicit `(x, y, z)` spatial coordinates and dimensions for each bay/level to compute Euclidean/Manhattan physical travel distances.
- **Access Constraints:** Granular access classification (`manual`, `forklift`, `any`) configured per level.
- **Platform & MU Capacity:** Configurable platform capacity and MU count per location, with row- or bay-level overrides.

### 3.2 Inventory Management & Ledger
- **Append-Only Ledger:** Immutable ledger entries for receipts, transfers, picks, replenishments, and adjustments.
- **Current Projections:** Fast material balances and location occupancy derived from the event ledger.
- **Atomic Reservations:** Reservation lifecycle (`reserved -> committed -> picked` or `released`) preventing overselling and deadlocks.
- **Multi-Source Supply:** Modeling internal batch production and inbound cross-market/store transfer supply streams.

### 3.3 Fulfillment Workflows & Task Allocation
- **Orders & Priorities:** Orders with line items, priority classes, hard deadlines, and waiting tolerances.
- **Task Dependencies:** Directed dependency graphs for pick, pack, replenish, and staging tasks.
- **Dual Resource Classes:** Separate modeling and dispatching of manual pickers (restricted to manual levels) and forklift operators (capable of upper forklift levels and bulk pallets).
- **Bay Congestion Modeling:** Dynamic contention when forklift replenishment occupies a bay, blocking or slowing concurrent manual picking in that bay.

### 3.4 Deterministic Discrete-Event Simulation
- **Baseline Policy:** Standard operational practice (e.g., nearest-neighbor order picking with reactive replenishment).
- **Alternative Policies:** Congestion-aware replenishment (deferring upper-level forklift moves outside active manual pick windows) and batch wave routing.
- **Side-by-Side Comparison:** Comparative diffs across fulfillment time, late order counts, total travel distance, picker idle time, and stock shortage events.
- **Golden Test Fixtures:** Byte-identical outcomes given the same input snapshot and random seed.

### 3.5 AI-Assisted Optimization & Governance
- **Operational Tooling:** Read-only analysis tools and strictly typed plan proposal tools.
- **Evidence-Backed Explanations:** Every recommendation cites specific location codes, MU IDs, order IDs, and simulation run IDs.
- **Plan Lifecycle:** `Proposed -> Reviewed -> Simulated -> Approved -> Committed` (with terminal states `Rejected` and `Expired`).

---

## 4. Phasing Strategy

### Phase A: Showcase Slice (Milestones M1–M5)
- **Target Audience:** Internal leadership and warehouse operations stakeholders.
- **Environment:** Purely local, offline-capable, single workspace (`ws_default`).
- **Data Engine:** Deterministically seeded in-memory repositories with synthetic retail/e-commerce inventory.
- **Simulation:** In-process TypeScript discrete-event engine (`packages/sim-engine`).
- **UI:** Enterprise-grade dashboard inspired by Linear and logistics control towers, featuring live vs. simulated comparative analytics and interactive top-down plan view.

### Phase B: Production Foundation (Milestones M6+)
- **Persistence:** Supabase (PostgreSQL with Row-Level Security, multi-tenant workspace isolation).
- **Job Orchestration:** Postgres-backed simulation run queue using `FOR UPDATE SKIP LOCKED`.
- **High-Performance Simulation:** Containerized C#/.NET deterministic worker reproducing identical golden-test outputs.
- **Security:** RBAC (`admin`, `planner`, `viewer`), audit logging, and external ERP/WMS connector stubs.

---

## 5. Non-Functional Requirements & Success Criteria

- **Reliability:** The showcase demo must never crash, throw unhandled exceptions, or display fabricated placeholder numbers.
- **Performance:** Interactive top-down rendering of up to 2,500 locations (e.g. 26 rows × 20 bays × 4 levels) with sub-second filter updates.
- **Determinism:** 100% reproducible simulation metrics across runs with identical seeds.
- **Accessibility & UX:** High-contrast dark operational theme, tabular numerals for warehouse codes, full keyboard drill-down support.
