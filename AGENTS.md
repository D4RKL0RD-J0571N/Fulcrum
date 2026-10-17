# Standing Rules & Operations Guide for AI Agents — Fulcrum

This document serves as the authoritative operational manual and standing rules for AI agents and human developers collaborating on the **Fulcrum** platform.

---

## 1. System Identity & Mission

**Fulcrum** is a simulation-first, AI-assisted warehouse optimization platform engineered specifically for high-density multi-tier distribution centers. 

It tackles the physical realities of high-density storage:
- Deep-bay congestion and forklift contention.
- Manipulation Units (MUs) stored on multi-tier platform structures.
- Labor inefficiency caused by manual extraction delays and cage shuffle overhead.
- Flawed heuristic planning by replacing guesswork with **pure deterministic discrete-event simulation**, automated **batch-wave grouping**, and **verifiable AI governance**.

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

---

## 3. Architecture & Separation of Concerns

Fulcrum adheres strictly to **Clean Architecture** with pragmatic **Domain-Driven Design (DDD)**:

```text
                           +-------------------------------------+
                           |         Presentation Layer          |
                           |    apps/web (Next.js 14 App Router) |
                           +-------------------------------------+
                                              |
                                              v
                           +-------------------------------------+
                           |          Application Layer          |
                           |   Use Cases, Contracts & DTOs       |
                           +-------------------------------------+
                                  /           |           \
                                 /            |            \
                                v             v             v
       +----------------------------+  +--------------+  +-------------------+
       |        Domain Core         |  |  Sim Engine  |  |  WMS Connectors   |
       |  packages/domain           |  |  TS & .NET 9 |  |  SAP / Manhattan  |
       |  (Aggregates, Invariants)  |  |  Dual Parity |  |  Blue Yonder       |
       +----------------------------+  +--------------+  +-------------------+
                     ^
                     |
       +----------------------------+
       |     Persistence Layer      |
       |   packages/persistence     |
       |   - In-Memory (Showcase)   |
       |   - Supabase / PostgreSQL  |
       +----------------------------+
```

### Boundary Invariants
1. **Pure Domain (`packages/domain`)**:
   - Zero framework dependencies. No React, Next.js, Supabase SDK, ORM, or AI SDK imports.
   - Enforces core invariants: platform capacities, location coordinate derivation, immutable stock movement ledger, balance projections, and reservation state machines.
2. **Versioned Contracts (`packages/contracts`)**:
   - Strongly typed Zod schemas and TypeScript interfaces for simulation input/output snapshots (`SimulationInputSnapshot`, `SimulationOutputResult`).
   - The contract is language-agnostic, enabling 100% parity between TypeScript and C# engines.
3. **Layout Engine Boundary**:
   - The layout engine (parsing, formatting, geometry derivation) lives exclusively on the web/domain side.
   - The simulation engine **NEVER** parses human-readable location code strings (e.g., `EH14A`). Locations enter the simulation as resolved geometric entities: `{ id, x, y, z, accessType, capacity, isBlocked }`.
4. **Append-Only Inventory Ledger**:
   - Stock movements are immutable entries with idempotency keys.
   - Balance is a deterministic projection of committed movements minus active reservations.
5. **Multi-Tenancy by Design**:
   - Every entity, aggregate, and database table carries a `workspace_id`.
   - Production persistence enforces PostgreSQL Row-Level Security (RLS).
6. **Strict AI Governance**:
   - AI recommendations must link directly to entity keys (`location_code`, `mu_id`, `order_id`, `simulation_run_id`).
   - AI tools can propose plans; they can **never** mutate live operational ledgers directly without human review and approval.

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
│   └── web/                        # Next.js 14 App Router, Tailwind CSS, Control Tower UI
│       ├── src/app/                # App pages, interactive modals & side panels
│       ├── src/lib/                # Client facility state store & simulation snapshot adapter
│       └── tests/                  # Playwright E2E browser tests
├── packages/
│   ├── contracts/                  # Versioned Zod schemas and TypeScript interfaces
│   ├── domain/                     # Pure DDD aggregates, layout engine & WMS connectors
│   ├── persistence/                # In-memory and Supabase PostgreSQL repository adapters
│   └── sim-engine/                 # TypeScript discrete-event simulation engine & golden tests
├── workers/
│   └── sim-worker/                 # C# .NET 9 high-throughput simulation worker
│       ├── Fulcrum.SimWorker/      # Core worker application & Docker entry point
│       └── Fulcrum.SimWorker.Tests/# .NET Golden fixture and benchmark test suite
├── supabase/
│   └── migrations/                 # PostgreSQL DDL, multi-tenant RLS & seed scripts
└── docs/                           # Architecture specs, ADRs, and benchmark reports
```

---

## 7. Verification & Operational Commands

Before submitting code, pushing to GitHub, or declaring work complete, agents **must** execute and verify these commands:

### Run All Monorepo Tests (Vitest)
```bash
npm run test
```
*Executes tests across `@fulcrum/contracts`, `@fulcrum/domain`, `@fulcrum/persistence`, `@fulcrum/sim-engine`, and `apps/web`.*

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
