# Fulcrum — High-Density Warehouse Optimization Platform

Fulcrum is a simulation-first, AI-assisted fulfillment platform designed for high-density multi-tier distribution centers. It replaces guesswork and generic routing heuristics with pure deterministic discrete-event simulation, automated batch-wave grouping, and strict AI governance.

---

## 🌟 Key Features

1. **Deterministic Discrete-Event Simulation Engine**:
   - Zero hallucination / zero fabricated metrics: integer virtual time clock, seeded PRNG (PCG-32), and golden-file byte-identical reproducibility.
   - Dual-engine implementation: Pure TypeScript package (`@fulcrum/sim-engine`) for zero-config offline runs in the browser/Node, and high-performance containerized C# .NET 9 worker (`Fulcrum.SimWorker`) executing >80,000 orders/sec.
2. **High-Density Storage & Manipulation Unit (MU) Modeling**:
   - Support for 6-digit mixed containers (MUs, e.g., `502900`, `101003`) containing packs of 5 to 6 units per sequential size variant.
   - Granular physical constraints: Level A ground-tier platform extraction penalties (18s), inner cage shuffle delays (25s), and upper-tier forklift contention lockouts (180s).
   - Up to 18 boxes per rack level across 2 platforms (9 MUs per platform).
3. **Control Tower Web UI (`apps/web`)**:
   - Next.js 14 App Router with Tailwind CSS and Radix UI primitives.
   - 2D interactive top-down plan view with real-time heatmaps.
   - Right drawer rack elevation inspection and global 6-digit MU locator.
   - Governed AI recommendation panel linking directly to entity evidence chips.
   - Side-by-side strategy comparator (Baseline vs. Batch-Wave Proposal 4a).
4. **Clean Architecture & Multi-Tenancy**:
   - Pure domain core (`@fulcrum/domain`), versioned contracts (`@fulcrum/contracts`), and append-only inventory ledger.
   - Supabase / PostgreSQL persistence adapter (`@fulcrum/persistence`) with Row-Level Security (RLS) tenant isolation.
   - Enterprise WMS (Manhattan, Blue Yonder) and ERP (SAP) normalization connectors.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm 10+
- .NET 9 SDK (optional, for C# simulation worker)
- Docker (optional, for containerized sim worker)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Web Application
```bash
npm --workspace=apps/web run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the Operations Control Tower.

### 3. Run Test Suites
```bash
# Run Vitest test suite across all monorepo packages
npm run test

# Run C# .NET unit and golden fixture tests
dotnet test workers/sim-worker/Fulcrum.SimWorker.Tests/Fulcrum.SimWorker.Tests.csproj

# Run Playwright end-to-end browser tests
npm --workspace=apps/web run test:e2e
```

### 4. Run the C# Simulation Worker (Standalone Self-Test Mode)
```bash
dotnet run --project workers/sim-worker/Fulcrum.SimWorker/Fulcrum.SimWorker.csproj
```

---

## 📁 Repository Structure

```text
Fulcrum/
├── apps/
│   └── web/                   # Next.js 14 App Router dashboard & layout editor
├── packages/
│   ├── contracts/             # Versioned Zod schemas and TypeScript interfaces
│   ├── domain/                # Pure DDD aggregates, layout engine & WMS connectors
│   ├── persistence/           # Supabase & in-memory inventory ledger repositories
│   └── sim-engine/            # TypeScript deterministic simulation engine
├── workers/
│   └── sim-worker/            # C# .NET 9 high-throughput simulation worker & tests
├── supabase/
│   └── migrations/            # SQL schemas, RLS policies & deterministic seed
└── docs/                      # Architectural specs, ADRs, and performance reports
```

---

## 📚 Documentation

- [Product Specification](docs/PRODUCT_SPEC.md)
- [Architecture Design](docs/ARCHITECTURE.md)
- [Simulation Contract](docs/SIMULATION_CONTRACT.md)
- [Warehouse Layout Specification](docs/LAYOUT_MODEL.md)
- [Performance & Latency Benchmark Report](docs/PERFORMANCE_REPORT.md)
- [Live Demo Script](docs/DEMO.md)
- [Standing Rules for Agents](AGENTS.md)
