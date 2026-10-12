# Fulcrum — Architecture Specification

## 1. Architectural Philosophy

Fulcrum adopts **Clean Architecture** principles combined with **Pragmatic Domain-Driven Design (DDD)**. The system isolates business logic from UI frameworks, persistence mechanisms, and AI providers.

```
       +-------------------------------------------------------+
       |                   Presentation Layer                  |
       |        (Next.js App Router, React, Tailwind, UI)      |
       +-------------------------------------------------------+
                                  |
                                  v
       +-------------------------------------------------------+
       |                    Application Layer                  |
       |      (Use Cases, Commands, Queries, Orchestrators)    |
       +-------------------------------------------------------+
            |                     |                     |
            v                     v                     v
+-----------------------+ +--------------------+ +-------------------+
|     Domain Layer      | | Simulation Adapter | |  AI Tool Adapter  |
| (Pure Models, Rules,  | | (packages/         | | (Mock Provider,   |
|  Ledger, Layout Engine| |  sim-engine)       | |  Tool Executor)   |
+-----------------------+ +--------------------+ +-------------------+
            ^
            |
+------------------------------------------------------+
|                  Persistence Layer                   |
|  - Phase A: In-Memory Deterministic Repositories     |
|  - Phase B: Supabase (PostgreSQL + RLS + Migrations) |
+------------------------------------------------------+
```

---

## 2. Core Layers and Responsibilities

### 2.1 Domain Layer (`packages/domain` or `src/domain`)
- **Zero External Dependencies:** Pure TypeScript. No React, Next.js, Supabase, Prisma, or AI SDK imports.
- **Aggregates & Entities:**
  - `WarehouseLayout`: Versioned configuration, template parsing, formatting, coordinate projection, distance calculation.
  - `Location`, `Platform`, `ManipulationUnit (MU)`, `Material`.
  - `StockLedgerEntry`, `StockReservation`: Immutable transaction log and reservation entities.
  - `Order`, `LineItem`, `FulfillmentTask`: Demand entities with priority and status lifecycles.
- **Invariants:** Business validation enforced at entity creation and state transitions.

### 2.2 Application Layer (`src/application`)
- **Use Cases / Service Contracts:**
  - `CreateLayoutVersionUseCase`, `ParseLocationQueryUseCase`.
  - `ExecuteStockMovementUseCase`, `CreateReservationUseCase`.
  - `TriggerSimulationRunUseCase`, `CompareSimulationScenariosUseCase`.
  - `ProposePlanUseCase`, `ReviewPlanUseCase`, `ApprovePlanUseCase`, `CommitPlanUseCase`.
- **Repository Interfaces:** Defined here, consumed by use cases, implemented by the persistence layer.

### 2.3 Persistence / Adapter Layer (`src/infrastructure/repositories`)
- **Phase A (Showcase):** In-memory repositories implementing repository interfaces, pre-populated with deterministic seed data generated from the active layout.
- **Phase B (Production):** Supabase PostgreSQL repository implementations enforcing Row-Level Security (RLS) based on authenticated session workspace claims.

### 2.4 Simulation Boundary (`packages/sim-engine`)
- **Independent Package:** Has zero awareness of web components, databases, or location code strings.
- **Snapshot Contract:** Application creates an immutable snapshot of locations, MUs, stock, and demand, serializing it with a SHA-256 hash.
- **Location Abstraction:** Locations exist in the simulation solely as `{ id: string, x: number, y: number, z: number, accessType: 'manual' | 'forklift' | 'any', capacity: number, isBlocked: boolean }`.
- **Phase A / Phase B Parity:** The TypeScript engine in Phase A and the C# engine in Phase B accept the exact same Zod/JSON input contract and emit the exact same output metrics.

### 2.5 AI Integration Boundary (`src/infrastructure/ai`)
- **Strictly Sandboxed:** The AI provider interacts through typed tools (`search_locations`, `inspect_bay_contention`, `propose_mitigation_plan`).
- **Read/Write Segregation:** Read tools query application projections. Write tools submit proposals to the `PlanLifecycle` service; they never mutate operational records directly.
- **Evidence Linking:** Every generated recommendation must reference entity keys (`location_code`, `mu_id`, `order_id`, `simulation_run_id`).

---

## 3. Multi-Tenancy Model

Multi-tenancy is designed into every layer from day one:
- Every entity, aggregate, and query includes `workspace_id`.
- Phase A sets a static seeded workspace: `ws_default`.
- Role-based permissions model:
  - `admin`: Manage warehouse layouts, workspace settings, commit plans.
  - `planner`: Run simulations, create reservations, propose/review plans.
  - `viewer`: Read-only access to maps, orders, stock projections, and simulation reports.

---

## 4. Architectural Boundaries Summary

| Boundary | Inbound | Outbound | Data Contract |
|---|---|---|---|
| **Web -> Application** | User actions, HTTP requests | JSON DTOs | Typed DTOs, validated with Zod |
| **Application -> Domain** | Method calls on aggregates | Domain events / Entities | Domain Objects & Value Objects |
| **Application -> Persistence** | Repository method calls | Hydrated entities | Repository Interfaces |
| **Application -> Simulation** | Run execution request | Simulation run result | Versioned Input/Output Snapshot |
| **Application -> AI** | Context & prompt | Tool call requests / Plans | Zod-validated Tool Schemas |
