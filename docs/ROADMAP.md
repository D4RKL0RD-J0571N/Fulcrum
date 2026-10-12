# Fulcrum — Development Roadmap

## Phase A: Showcase Slice (Milestones M1–M5)
Target: High-polish, locally runnable, deterministic showcase for leadership demo.

- [x] **M1: Docs and Decisions (Current Milestone)**
  - Comprehensive architectural specifications.
  - Domain, layout, simulation, and design system contracts.
  - Initial Architecture Decision Records (ADRs).
  - Open questions log and agent standing rules (`AGENTS.md`).

- [x] **M2: Project Scaffolding & Monorepo Setup**
  - Next.js 14+ App Router, TypeScript strict configuration.
  - Turborepo / pnpm workspace with `apps/web` and `packages/sim-engine`.
  - Tailwind CSS, shadcn/ui components, Lucide icons, Recharts.
  - Strict linting, formatting, Vitest unit test runner, Playwright e2e runner.
  - Environment variable schema validation (Zod).
  - In-memory repository abstractions and mock stores.

- [x] **M3: Pure Domain Core & Layout Engine**
  - `WarehouseLayout` aggregate and template parser/formatter.
  - Invariant validation: platform capacity, round-trip parsing (`parse(format(x)) === x`), rejection of ambiguous templates.
  - Fast-check property-based testing on three canonical layout configurations (with prefix, without prefix, numeric rows).
  - Append-only inventory transaction ledger and balance projection.
  - Deterministic synthetic seed generator.

- [x] **M4: Deterministic Simulation Engine Slice**
  - In-package TypeScript discrete-event simulator (`packages/sim-engine`).
  - Integer virtual time and seeded PRNG (PCG / xoshiro).
  - Baseline picking strategy vs. congestion-aware replenishment strategy.
  - Golden-file regression fixtures ensuring byte-identical metric outputs.

- [x] **M5: Dashboard & Layout Setup UI**
  - Interactive Layout Setup Wizard with live code preview and validation.
  - Operations Control Tower dashboard: KPI strip, top-down plan view, heatmap overlays.
  - Right drawer with rack elevation breakdown (manual vs. forklift levels).
  - Bottom panel: Fulfillment queue, Strategy Comparison matrix, and AI Governance panel.
  - Plan lifecycle workflow (`Proposed -> Reviewed -> Simulated -> Approved -> Committed`).
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
  - High-performance deterministic simulation worker in C#/.NET 8/9.
  - Docker containerization for worker dispatch.
  - Verification against shared M4 golden-file test fixtures.

- [x] **M8: Performance Hardening & Production Operations**
  - Performance benchmarking report (`p50`, `p95`, `p99` latencies, throughput).
  - Scalability verification for large facilities (100k+ storage locations).
  - External WMS/ERP connector stubs and final production readiness sign-off.
