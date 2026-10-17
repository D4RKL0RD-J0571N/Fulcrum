# Fulcrum — High-Density Warehouse Optimization Platform

Fulcrum is a simulation-first, AI-assisted fulfillment platform designed for high-density multi-tier distribution centers. It replaces guesswork and generic routing heuristics with pure deterministic discrete-event simulation, automated batch-wave grouping, and strict AI governance.

---

## 🌟 Key Capabilities

1. **Deterministic Discrete-Event Simulation Engine**:
   - Zero hallucination / zero fabricated metrics: integer virtual time clock (seconds), seeded PRNG (PCG-32), and golden-file byte-identical reproducibility.
   - Dual-engine architecture: Pure TypeScript package (`@fulcrum/sim-engine`) for zero-config runs in the browser/Node, and high-throughput containerized C# .NET 9 worker (`Fulcrum.SimWorker`) executing >80,000 orders/sec.
2. **High-Density Storage & Manipulation Unit (MU) Modeling**:
   - Support for 6-digit mixed containers (MUs, e.g., `502900`, `101003`) containing packs of 5 to 6 units per sequential size variant.
   - Granular physical constraints: Level A ground-tier platform extraction penalties (18s), inner cage shuffle delays (25s), and upper-tier forklift contention lockouts (180s).
   - Standard rack shelf density: 2 platforms per location, 9 MUs per platform (**18 boxes per rack level**).
3. **Control Tower Web UI (`apps/web`)**:
   - Next.js 14 App Router with Tailwind CSS and Radix UI primitives.
   - 2D interactive top-down plan view with real-time heatmaps and travel route overlays.
   - Slide-out rack elevation drawer and global 6-digit MU search locator.
   - Interactive Facility Blueprint Reconfiguration modal (dynamic rows, bays, aisle spacing).
   - Live Order Queue Creation modal (custom 9-digit order generation with urgent/standard SLA).
   - Material Allocation modal for live inventory placement.
   - Governed AI recommendation panel linking directly to entity evidence chips.
   - Side-by-side strategy comparator (Baseline discrete picking vs. Batch-Wave Proposal 4a).
4. **Clean Architecture & Multi-Tenancy**:
   - Pure domain core (`@fulcrum/domain`), versioned contracts (`@fulcrum/contracts`), and append-only inventory ledger.
   - Supabase / PostgreSQL persistence adapter (`@fulcrum/persistence`) with Row-Level Security (RLS) tenant isolation on `workspace_id`.
   - Enterprise WMS (Manhattan Associates, Blue Yonder) and ERP (SAP) normalization connectors.

---

## 🏗️ Architecture

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
Open [http://localhost:3000](http://localhost:3000) to launch the Operations Control Tower.

### 3. Run Test Suites
```bash
# Run Vitest test suite across all monorepo packages
npm run test

# Run C# .NET unit and golden fixture tests
dotnet test workers/sim-worker/Fulcrum.SimWorker.Tests/Fulcrum.SimWorker.Tests.csproj

# Run Playwright end-to-end browser tests
npm --workspace=apps/web run test:e2e
```

### 4. Build for Production
```bash
npm --workspace=apps/web run build
```

### 5. Run the C# Simulation Worker (Standalone Self-Test Mode)
```bash
dotnet run --project workers/sim-worker/Fulcrum.SimWorker/Fulcrum.SimWorker.csproj
```

---

## 📁 Repository Structure

```text
Fulcrum/
├── apps/
│   └── web/                   # Next.js 14 App Router dashboard, interactive modals & map
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

## 📚 Documentation Index

- [Standing Rules for AI Agents](AGENTS.md)
- [Product Specification](docs/PRODUCT_SPEC.md)
- [Architecture Specification](docs/ARCHITECTURE.md)
- [Development Roadmap & Milestones](docs/ROADMAP.md)
- [Simulation Contract Specification](docs/SIMULATION_CONTRACT.md)
- [Warehouse Layout Specification](docs/LAYOUT_MODEL.md)
- [Performance & Latency Benchmark Report](docs/PERFORMANCE_REPORT.md)
- [Executive Demo Script](docs/DEMO.md)
- [Open Questions & Decision Log](docs/OPEN_QUESTIONS.md)
- [Architecture Decision Records (ADRs)](docs/ADR/)
  - [ADR-001: Simulation Engine Boundary](docs/ADR/ADR-001-simulation-engine-boundary.md)
  - [ADR-002: Layout as Configuration](docs/ADR/ADR-002-layout-as-configuration.md)
  - [ADR-003: Fixed Segment Order (v1)](docs/ADR/ADR-003-fixed-segment-order-v1.md)
  - [ADR-004: Inventory as Append-Only Ledger](docs/ADR/ADR-004-inventory-as-append-only-ledger.md)
  - [ADR-005: 2D Plan View vs 3D](docs/ADR/ADR-005-2d-plan-view-vs-3d.md)
  - [ADR-006: In-Memory Repositories for Phase A](docs/ADR/ADR-006-in-memory-repositories-phase-a.md)
