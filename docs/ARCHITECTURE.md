# Fulcrum — Architecture Specification

## 1. Architectural Philosophy

Fulcrum adopts **Clean Architecture** combined with pragmatic **Domain-Driven Design (DDD)**. The system isolates pure fulfillment planning and business invariants from presentation frameworks, local storage mechanisms, and external persistence adapters.

```text
                           +-------------------------------------+
                           |         Presentation Layer          |
                           |    apps/web (Next.js 14 App Router) |
                           |  - Order Intake & Material Views    |
                           |  - Collection Plan & Floor Checklist|
                           |  - @media print Stylesheet          |
                           +-------------------------------------+
                                              │
                                              ▼
                           +-------------------------------------+
                           |          Application Layer          |
                           |   Planning Store & State Container  |
                           |   Isolated localStorage Checklist   |
                           +-------------------------------------+
                                              │
                                              ▼
                           +-------------------------------------+
                           |             Domain Layer            |
                           |   packages/domain (Pure TypeScript) |
                           |  - OrderMaterialPlanner             |
                           |  - resolveCurrentObservations       |
                           |  - MU Location Conflict Guards      |
                           +-------------------------------------+
                                       /              \
                                      /                \
                                     v                  v
                 +-----------------------+  +-----------------------+
                 |   Simulation Engine   |  |   Persistence Layer   |
                 |  - @fulcrum/sim-engine|  |  - In-Memory Repos    |
                 |  - Fulcrum.SimWorker  |  |  - Supabase / Postgres|
                 +-----------------------+  +-----------------------+
```

---

## 2. Core Layers and Responsibilities

### 2.1 Domain Layer (`packages/domain`)
- **Zero External Dependencies**: Pure TypeScript without frameworks, UI libraries, or database SDKs.
- **`OrderMaterialPlanner`**: Deterministic allocation engine that consolidates multi-order demand, matches against active stock observations, and groups extractions into physical Manipulation Unit (MU) collection tasks.
- **Observation Resolver (`resolveCurrentObservations`)**: Normalizes locations and MU keys, supersedes older observations with newer snapshots, and preserves distinct stock across physical locations.
- **Conflict & Readiness Guarding**: Detects contradictory locations for identical physical MUs, prevents silent resolution, and guards plan execution readiness.

### 2.2 Presentation Layer (`apps/web`)
- **Next.js 14 App Router**: Fast, responsive client-side interface built with Tailwind CSS.
- **Focused Desk-Side Views**:
  - **Orders Tab**: Intake and review of customer order requirements ("Visualize Order").
  - **Stock Tab**: Ingestion and review of externally reported inventory snapshots ("Visualize Material").
  - **Plan Tab**: Structured collection plan showing distinct physical MUs, extraction line items, order destinations, and operational warning banners.
- **Print Optimization**: Dedicated `@media print` rules in `globals.css` that strip navigation chrome, search inputs, and modal controls, rendering clean, high-contrast collection plans with page-break protection.
- **Touch-Friendly Floor Checklist**: Interactive checklist allowing operators to mark off physical MUs and extraction lines while on the floor.

### 2.3 Application State & Floor Checklist Isolation
- **Planning State (`planningStore`)**: Manages the collection of orders, active observations, selected order IDs, and calculation history.
- **Checklist State Isolation**:
  - The floor checklist state (`checkedTasks`, `checkedItems`) is decoupled from planning calculations and inventory records.
  - Persisted in browser `localStorage` keyed by `fulcrum_checklist_${runId}`.
  - Checking or unchecking tasks **never** mutates stock observations, decrements balances, or recalculates the current plan.

### 2.4 Foundational Simulation & Worker Layer (`packages/sim-engine`, `workers/sim-worker`)
- Maintained as deterministic discrete-event simulation engines in TypeScript and C# .NET 9.
- Used for warehouse-level physical congestion modeling (deep-bay forklift contention, multi-tier platform retrieval delays) with golden-file regression test parity.

---

## 3. Data Contracts and Boundaries

| Boundary | Inbound | Outbound | Data Contract |
|---|---|---|---|
| **Web UI -> Application Store** | User actions (order toggle, observation entry) | Updated React state | `PlanningAppState` |
| **Application Store -> Domain** | `Order[]`, `selectedOrderIds`, `StockObservation[]` | Calculated plan & warnings | `PlanningRun` (`ManipulationUnitPickTask[]`, `PlanningSummary`) |
| **Checklist -> Local Storage** | Task & item toggle actions | Serialized checklist map | `fulcrum_checklist_${runId}` JSON |
| **Web -> Print Subsystem** | Print command / Ctrl+P | High-contrast physical printout | CSS `@media print` styles (`.print-avoid-break`, `.no-print`) |
