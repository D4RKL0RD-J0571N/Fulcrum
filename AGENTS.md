# Standing Rules & Operations Guide for AI Agents — Fulcrum

This document serves as the authoritative operational manual and standing rules for AI agents and human developers collaborating on the **Fulcrum** platform.

---

## 1. System Identity & Mission

**Fulcrum** is a focused, desk-side order-fulfillment and Manipulation Unit (MU) collection planning tool used alongside an existing warehouse billing and checkout application. Its primary operational mission is to help warehouse pickers and operators prepare complete, reliable, and executable physical collection plans before heading out onto the floor, eliminating costly desk round-trips caused by unclear instructions, missing quantities, multi-order confusion, or contradictory container locations.

Underneath the fulfillment planner, Fulcrum also maintains a deterministic discrete-event simulation core designed for high-density multi-tier distribution centers, modeling physical platform constraints, bay contention, and batch-wave grouping.

---

## 2. Phasing & Milestone Status

| Phase | Milestone | Focus Area | Status |
|:---|:---|:---|:---|
| **Phase A** | **M1** | System Architecture & Contracts Specification | ✅ Complete & Verified |
| | **M2** | Monorepo Scaffolding, Tooling & Strict TypeScript Base | ✅ Complete & Verified |
| | **M3** | Pure Domain Core, Layout Engine & Append-Only Ledger | ✅ Complete & Verified |
| | **M4** | Deterministic Discrete-Event Simulation Engine (TypeScript) | ✅ Complete & Verified |
| | **M5** | Operations Control Tower Web Dashboard & Layout Configurator | ✅ Complete & Verified |
| **Phase B** | **M6** | Supabase Persistence, Multi-Tenant RLS & SQL Migrations | ✅ Complete & Verified |
| | **M7** | Containerized High-Throughput C# .NET 9 Simulation Worker | ✅ Complete & Verified |
| | **M8** | Performance Hardening, Golden Parity & Enterprise WMS Connectors | ✅ Complete & Verified |
| **Phase C** | **M9** | Offline Stock Observations & Multi-Order Demand Consolidation | ✅ Complete & Verified |
| | **M10** | Physical Manipulation Unit (MU) Planning & Consolidation | ✅ Complete & Verified |
| | **M11** | MU Conflict Guards, Print Layout & Decoupled Floor Checklist | ✅ Complete & Verified |

---

## 3. Architecture & Separation of Concerns

Fulcrum adheres strictly to **Clean Architecture** with pragmatic **Domain-Driven Design (DDD)**:

```text
                           +-------------------------------------+
                           |         Presentation Layer          |
                           |    apps/web (Next.js 14 App Router) |
                           |  - Orders & Stock Observation Views |
                           |  - Collection Plan & Floor Checklist|
                           |  - @media print Stylesheet          |
                           +-------------------------------------+
                                              |
                                              v
                           +-------------------------------------+
                           |          Application Layer          |
                           |   Order Intake & Planning Store     |
                           |   Isolated localStorage Checklist   |
                           +-------------------------------------+
                                   /           |           \
                                  /            |            \
                                 v             v             v
       +----------------------------+  +--------------+  +-------------------+
       |        Domain Core         |  |  Sim Engine  |  |  WMS Connectors   |
       |  packages/domain           |  |  TS & .NET 9 |  |  SAP / Manhattan  |
       |  (OrderMaterialPlanner,    |  |  Dual Parity |  |  Blue Yonder       |
       |   Observation Resolver)    |  |  Engines     |  |  (Legacy/Stubs)   |
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

### Boundary Invariants
1. **Pure Domain (`packages/domain`)**:
   - Zero framework dependencies. No React, Next.js, Supabase SDK, ORM, or AI SDK imports.
   - Enforces core fulfillment planning rules: `OrderMaterialPlanner`, `resolveCurrentObservations`, MU consolidation, shortage reporting, and location conflict detection.
2. **Physical MU vs. Material Piece Distinction**:
   - Physical container counts (`totalDistinctMUsToCollect`) must **never** be conflated with material piece counts (`totalAllocatedPieces`).
   - Loose/uncontainerized stock contributes to piece counts but does not increment MU container counts.
3. **MU Location Singularity & Conflict Detection**:
   - An MU cannot exist in multiple locations simultaneously. If observations report conflicting locations, the domain MUST raise `CONFLICTING_MU_LOCATION`, preserve exactly 1 physical MU task, never guess between locations, and guard execution readiness (`isPlanExecutable: false`).
4. **Floor Checklist Decoupling**:
   - Floor checklist interactions in `apps/web` are persisted in client `localStorage` and MUST NEVER mutate stock observations, decrement ledger balances, or recalculate active plans.
5. **Offline Stock Observation Semantics**:
   - Refreshed observations supersede older snapshots for the same material SKU, location, and MU.
   - The system must never sum historical observations or silently discard unrelated SKU contents of a container.
6. **No Phantom Integrations**:
   - No direct network scraping, OCR, clipboard parsing, or automated write-back bots interacting with host billing systems.

---

## 4. Physical Domain & Storage Specifications

All agents and contributors must respect these exact warehouse domain constants:

- **Shelf Structure**:
  - Each standard bay contains multi-tier levels (Level A: Ground, Level B: Mid, Level C: Top Manual, Level D: Forklift Only).
  - Each rack level contains **2 platforms** (`plat_1` and `plat_2`).
  - Each platform holds **9 Manipulation Units (MUs)** organized in three layers of 3.
  - Total density: **18 boxes per rack level** across the two platforms.
- **Manipulation Units (MUs)**:
  - 6-digit alphanumeric tracking codes (e.g., `502900`, `101003`).
  - Pack quantity: 5 to 6 units per sequential size variant (e.g., Slim S, Slim M, Slim L).
- **Physical Contention Penalties**:
  - **Level A Ground Tier**: `18 seconds` extraction penalty per platform access.
  - **Inner Cage Shuffle**: `25 seconds` delay when retrieving inner/buried MUs.
  - **Upper-Tier Forklift Contention**: `180 seconds` bay lockout during pallet insertion, blocking manual pickers.

---

## 5. Strict Simulation Determinism Rules

The simulation engines (`packages/sim-engine` and `workers/sim-worker`) must maintain zero fabrication and absolute reproducibility:

1. **Integer Virtual Time**: Time is measured strictly in discrete integer seconds. Floating-point timestamps and real-time clocks (`Date.now()`, `DateTime.UtcNow`) are forbidden in the simulation loop.
2. **Deterministic Seeded PRNG**: Randomization relies exclusively on a seeded PRNG (PCG-32 or xoshiro256**). Never use `Math.random()` or unseeded system RNG.
3. **Deterministic Tie-Breaking**: Events occurring at the exact same second are ordered deterministically by:
   $$\text{sort key} = (\text{timestamp}, \text{event\_type}, \text{entity\_id})$$
4. **Content Hashing**: Input snapshots include a SHA-256 content hash.
5. **Golden-File Parity**: Given the same input snapshot and seed, both the TypeScript engine and C# .NET worker must emit identical output metrics:
   - Order cycle times
   - Traveled distances
   - MU contention counts
   - SLA fulfillment rates

---

## 6. Monorepo Structure

```text
Fulcrum/
├── apps/
│   └── web/                        # Next.js 14 App Router, Tailwind CSS, Planning UI & Floor Checklist
│       ├── e2e/                    # Playwright E2E browser tests
│       ├── src/app/                # App pages, @media print globals.css, planning dashboard
│       ├── src/components/         # ThemeToggle and shared controls
│       └── src/lib/                # Planning store, state management & seed scenarios
├── packages/
│   ├── contracts/                  # Versioned Zod schemas and TypeScript interfaces
│   ├── domain/                     # Pure DDD: OrderMaterialPlanner, observation resolver, conflict guards
│   ├── persistence/                # In-memory and Supabase PostgreSQL repository adapters
│   └── sim-engine/                 # TypeScript discrete-event simulation engine & golden tests
├── workers/
│   └── sim-worker/                 # C# .NET 9 high-throughput simulation worker
│       ├── Fulcrum.SimWorker/      # Core worker application & Docker entry point
│       └── Fulcrum.SimWorker.Tests/# .NET Golden fixture and benchmark test suite
├── supabase/
│   └── migrations/                 # PostgreSQL DDL, multi-tenant RLS & seed scripts
└── docs/                           # Architecture specs, ADRs, and product specifications
```

---

## 7. Verification & Operational Commands

Before submitting code, pushing to GitHub, or declaring work complete, agents **must** execute and verify these commands:

### Run All Monorepo Tests (Vitest)
```bash
npm run test
```
*Executes tests across `@fulcrum/contracts`, `@fulcrum/domain` (13 planning tests + 9 aggregate tests), `@fulcrum/persistence`, `@fulcrum/sim-engine`, and `apps/web`.*

### Run Strict Monorepo Typecheck
```bash
npm run typecheck
```
*Validates TypeScript compilation with zero errors across all workspaces.*

### Run C# .NET Worker Tests
```bash
dotnet test workers/sim-worker/Fulcrum.SimWorker.Tests/Fulcrum.SimWorker.Tests.csproj
```
*Validates C# .NET 9 implementation against shared golden-file fixtures and benchmarks (>80,000 orders/sec).*

### Run Standalone C# Simulation Worker
```bash
dotnet run --project workers/sim-worker/Fulcrum.SimWorker/Fulcrum.SimWorker.csproj
```

### Validate Production Web Build
```bash
npm --workspace=apps/web run build
```
*Ensures strict TypeScript compilation, Next.js static optimization, and zero lint/type errors.*

### Run Playwright E2E Tests
```bash
npm --workspace=apps/web run test:e2e
```
*Executes end-to-end tests validating observation intake, MU planning, location conflicts, and checklist persistence.*

### Start Local Web Dev Server
```bash
npm --workspace=apps/web run dev
```

---

## 8. Standing Rules for AI Agents

1. **Strict Milestone Phasing**: Complete and verify all criteria before marking any milestone done.
2. **Honesty & Verification**: Never claim a feature is complete without executing the relevant test or build command and verifying the exact terminal output.
3. **Repository Hygiene**: Do not leave dangling imports, broken types, or unformatted files. Check `git status` and run builds before committing.
4. **Clean Code Alignment (Jostin's Style)**:
   - Prioritize clarity, modularity, and explicit logic over magic behavior.
   - Enforce type hints, docstrings, and meaningful naming conventions (`PascalCase` in C#, `camelCase` in TS).
   - Functions must stay under 50 lines; break down into focused helpers if longer.
   - Never push code that breaks existing tests or builds.
5. **No Synthetic Data Inventions**: Adhere to the established synthetic data schema (6-digit MUs, 9-digit orders, 10-digit SKUs, WH-01 layout). Never attempt to connect to external confidential systems.
