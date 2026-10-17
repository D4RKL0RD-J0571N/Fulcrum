# Fulcrum — Order-Specific Material Planning & Fulfillment Tool

Fulcrum is a fast, professional, desk-side order-fulfillment planning tool engineered for warehouse operators and planners. Used alongside an existing warehouse checkout and billing application, Fulcrum consolidates material demand across selected customer orders, organizes offline stock observations, and generates an actionable, reliable physical collection plan before workers step onto the warehouse floor.

Fulcrum eliminates costly floor round-trips caused by missing instructions, ambiguous quantities, multi-order confusion, or conflicting container locations.

---

## 🌟 Key Capabilities

1. **Order-Specific Demand & Physical Manipulation Unit (MU) Planning**:
   - Models physical containers (6-digit Manipulation Units like `502900`, `101003`) as shared handling units.
   - Distinct metric tracking: unambiguously reports **total distinct physical MUs to collect** versus **total material pieces to extract**.
   - Multi-order and multi-SKU consolidation: aggregates multiple required items from the same physical MU into a single collection task.
   - Clean support for loose or uncontainerized stock without miscounting it as a physical container.
   - Granular order-line level allocation traceability and shortage reporting.

2. **Offline Stock Observation Semantics**:
   - Designed for desk-side manual entry from existing operational screens:
     - **Visualize Order**: demand requirements by material SKU, description, and quantity.
     - **Visualize Material**: stock snapshots reported at specific bays/locations and MUs.
   - Deterministic observation resolution (`resolveCurrentObservations`): refreshed observations cleanly supersede older snapshots for the same SKU, location, and MU without duplicate counting or accidental deletion of unrelated contents.
   - Graceful freshness tracking: warns on stale observations according to configurable thresholds without silently invalidating usable stock.

3. **Operational Safety & Location Conflict Detection**:
   - Detects when observations associate the same physical MU identifier with multiple distinct physical locations.
   - Emits explicit `CONFLICTING_MU_LOCATION` warnings and tags affected pick tasks.
   - **Guaranteed Singularity**: preserves exactly one physical MU count—never duplicates or silently guesses between conflicting locations.
   - **Execution Readiness Guard**: flags plans with unresolved conflicts (`isPlanExecutable: false`, `hasUnresolvedConflicts: true`) so issues are resolved at the desk.

4. **Execution-Ready Floor Tools**:
   - **Print-Friendly Collection Plan**: `@media print` stylesheet that strips navigation, form controls, and action chrome, leaving high-contrast typography, crisp borders, page-break protected cards, and prominent conflict warnings.
   - **Interactive Floor Collection Checklist**: touch-friendly checkboxes for MUs and individual extraction lines with real-time progress indicators. State is saved locally in `localStorage` and strictly decoupled from inventory records—checking items never alters stock or recalculates plans.
   - **Clipboard Export**: cleanly formatted plaintext summary for terminal or message dispatch, highlighting conflicts and operational warnings.

5. **Foundational Monorepo & Deterministic Simulation Engine**:
   - Pure domain core (`@fulcrum/domain`) enforcing invariants with zero external dependencies.
   - Deterministic discrete-event simulation engines in TypeScript (`@fulcrum/sim-engine`) and high-throughput C# .NET 9 (`Fulcrum.SimWorker`) with golden-file regression parity for deep-bay congestion and multi-tier platform modeling.

---

## 🏗️ Architecture

```text
                           +-------------------------------------+
                           |         Presentation Layer          |
                           |    apps/web (Next.js 14 App Router) |
                           |  - Order Intake & Material Views    |
                           |  - Collection Plan & Floor Checklist|
                           +-------------------------------------+
                                              |
                                              v
                           +-------------------------------------+
                           |          Application Layer          |
                           |   Order Intake & Planning Store     |
                           |   Client State & Local Persistence  |
                           +-------------------------------------+
                                   /           |           \
                                  /            |            \
                                 v             v             v
       +----------------------------+  +--------------+  +-------------------+
       |        Domain Core         |  |  Sim Engine  |  |  WMS Connectors   |
       |  packages/domain           |  |  TS & .NET 9 |  |  SAP / Manhattan  |
       |  (OrderMaterialPlanner,    |  |  Dual Parity |  |  Blue Yonder       |
       |   MU Aggregates, Invariants|  |  Engines     |  |  (Legacy/Stubs)   |
       +----------------------------+  +--------------+  +-------------------+
                     ^
                     |
       +----------------------------+
       |     Persistence Layer      |
       |   packages/persistence     |
       |   - In-Memory / LocalState |
       |   - Supabase / PostgreSQL  |
       +----------------------------+
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm 10+
- .NET 9 SDK (optional, for C# simulation worker)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Web Application
```bash
npm --workspace=apps/web run dev
```
Open [http://localhost:3000](http://localhost:3000) to launch the Fulcrum Planning Dashboard.

### 3. Run Test Suites
```bash
# Run Vitest test suite across all monorepo packages (Domain, Contracts, Persistence, SimEngine, Web)
npm run test

# Run strict TypeScript typecheck across all packages
npm run typecheck

# Run Playwright end-to-end browser tests
npm --workspace=apps/web run test:e2e

# Run C# .NET unit and golden fixture tests
dotnet test workers/sim-worker/Fulcrum.SimWorker.Tests/Fulcrum.SimWorker.Tests.csproj
```

### 4. Build for Production
```bash
npm --workspace=apps/web run build
```

---

## 📁 Repository Structure

```text
Fulcrum/
├── apps/
│   └── web/                   # Next.js 14 App Router: planning forms, collection plan, floor checklist & print view
│       ├── e2e/               # Playwright E2E browser test suites
│       └── src/
│           ├── app/           # App routes, globals.css (@media print), main planning dashboard
│           ├── components/    # Reusable UI controls (ThemeToggle, etc.)
│           └── lib/           # Planning store, state management & seed scenarios
├── packages/
│   ├── contracts/             # Versioned Zod schemas and TypeScript interfaces
│   ├── domain/                # Pure DDD core: OrderMaterialPlanner, observation resolver, conflict guards
│   ├── persistence/           # Repositories and state adapters
│   └── sim-engine/            # TypeScript deterministic discrete-event simulation engine
├── workers/
│   └── sim-worker/            # C# .NET 9 high-throughput simulation worker & tests
├── supabase/
│   └── migrations/            # SQL schemas and RLS policies
└── docs/                      # Product specs, architecture specs, and operational guides
```

---

## 📚 Documentation Index

- [Standing Rules for AI Agents](AGENTS.md)
- [Product Specification](docs/PRODUCT_SPEC.md)
- [Domain Model Specification](docs/DOMAIN_MODEL.md)
- [Architecture Specification](docs/ARCHITECTURE.md)
- [Development Roadmap & Milestones](docs/ROADMAP.md)
- [Open Questions & Decision Log](docs/OPEN_QUESTIONS.md)
- [Design System & UI Guidelines](docs/DESIGN_SYSTEM.md)
- [Simulation Contract Specification](docs/SIMULATION_CONTRACT.md)
