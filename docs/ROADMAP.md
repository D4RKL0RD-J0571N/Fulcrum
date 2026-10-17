# Fulcrum — Development Roadmap

## Phase A: Showcase Slice (Milestones M1–M5)
Target: High-polish, locally runnable, deterministic showcase for leadership demo.

- [x] **M1: Docs and Decisions**
  - Comprehensive architectural specifications.
  - Domain, layout, simulation, and design system contracts.
  - Initial Architecture Decision Records (ADRs).
  - Open questions log and agent standing rules (`AGENTS.md`).

- [x] **M2: Project Scaffolding & Monorepo Setup**
  - Next.js 14+ App Router, TypeScript strict configuration.
  - Turborepo / npm workspace with `apps/web` and `packages/sim-engine`.
  - Tailwind CSS, Lucide icons, Recharts.
  - Strict linting, formatting, Vitest unit test runner, Playwright e2e runner.
  - Environment variable schema validation (Zod).
  - In-memory repository abstractions and mock stores.

- [x] **M3: Pure Domain Core & Layout Engine**
  - `WarehouseLayout` aggregate and template parser/formatter.
  - Invariant validation: platform capacity, round-trip parsing (`parse(format(x)) === x`), rejection of ambiguous templates.
  - Property-based testing on canonical layout configurations.
  - Append-only inventory transaction ledger and balance projection.
  - Deterministic synthetic seed generator.

- [x] **M4: Deterministic Simulation Engine Slice**
  - In-package TypeScript discrete-event simulator (`packages/sim-engine`).
  - Integer virtual time and seeded PRNG (PCG-32).
  - Baseline picking strategy vs. congestion-aware replenishment strategy.
  - Golden-file regression fixtures ensuring byte-identical metric outputs.

- [x] **M5: Dashboard & Layout Setup UI**
  - Interactive Layout Setup Wizard with live code preview and validation.
  - Operations Control Tower dashboard: KPI strip, top-down plan view, heatmap overlays.
  - Rack elevation breakdown (manual vs. forklift levels).
  - Fulfillment queue and strategy comparison matrix.
  - Playwright integration tests and demo script (`docs/DEMO.md`).

---

## Phase B: Production Foundation (Milestones M6–M8)
Target: Industrial-grade multi-tenant platform with persistence and high-throughput worker.

- [x] **M6: Supabase Persistence & Row-Level Security**
  - PostgreSQL schema migrations, indexes, and constraints.
  - Supabase Auth and Workspace RLS policies.
  - Postgres append-only inventory ledger implementation.
  - Postgres-backed job queue for simulation runs using `FOR UPDATE SKIP LOCKED`.

- [x] **M7: Containerized C#/.NET Simulation Engine**
  - High-performance deterministic simulation worker in C#/.NET 9 (`Fulcrum.SimWorker`).
  - Docker containerization for worker dispatch.
  - Verification against shared M4 golden-file test fixtures (>80,000 orders/sec).

- [x] **M8: Performance Hardening & Production Operations**
  - Performance benchmarking report (`p50`, `p95`, `p99` latencies, throughput).
  - Scalability verification for large facilities (100k+ storage locations).
  - External WMS/ERP connector stubs and final production readiness sign-off.

---

## Phase C: Order-Specific Planning & Operational Readiness (Milestones M9–M11)
Target: Fast, professional desk-side fulfillment planning tool eliminating floor round-trips.

- [x] **M9: Offline Stock Observations & Demand Consolidation**
  - Desk-side intake forms: "Visualize Order" (requirements) & "Visualize Material" (stock snapshots).
  - Deterministic observation resolution (`resolveCurrentObservations`): supersedes older snapshots per SKU+location+MU.
  - Freshness threshold warning logic (configurable, default 60 min) without discarding usable inventory.
  - Multi-order requirement aggregation and line-level shortage detection.

- [x] **M10: Physical Manipulation Unit (MU) Planning & Consolidation**
  - Explicit physical container modeling (6-digit MUs like `502900`).
  - Separate reporting of **total distinct physical MUs to collect** vs. **total material pieces to extract**.
  - Multi-SKU consolidation: aggregates multiple materials in the same container into a single pick task.
  - Multi-order grouping: maps extractions to their destination order lines without double-counting.
  - Support for uncontainerized loose stock (`isLooseStock: true`) without false container counts.

- [x] **M11: Operational Safety, Conflict Detection & Floor Execution**
  - **MU Location Conflict Detection**: detects identical MUs observed at multiple distinct locations; preserves singularity (1 MU count) and halts execution readiness (`isPlanExecutable = false`).
  - **Print-Friendly Collection Plan**: `@media print` stylesheet stripping non-operational chrome, enforcing page-break protection and visible conflict warnings.
  - **Floor Collection Checklist**: touch-friendly checklist for MUs and extractions, with isolated client persistence in `localStorage` (`fulcrum_checklist_${runId}`). Checking items never mutates stock or alters plans.
  - **Verification**: 13 domain unit tests (`planning.test.ts`) and 8 Playwright E2E browser tests (`dashboard.spec.ts`).
