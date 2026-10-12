# ADR-006: In-Memory Repositories in Phase A

## Status
Accepted

## Context
Phase A (Milestones M1–M5) is focused on delivering a rock-solid, locally runnable showcase slice for company leadership. The demonstration must operate completely offline, spin up instantaneously without database containers or cloud credentials, and deliver 100% deterministic results across all repeated runs.

## Decision
1. Application use cases will interact exclusively with domain repository interfaces (e.g. `WarehouseLayoutRepository`, `InventoryLedgerRepository`, `OrderRepository`, `SimulationRunRepository`).
2. For Phase A, we implement high-fidelity in-memory repository adapters (`InMemoryWarehouseLayoutRepository`, etc.).
3. The in-memory repositories are seeded at startup using a pure deterministic synthetic data generator seeded with a fixed random seed.
4. Phase B introduces the Supabase / PostgreSQL implementations behind the exact same repository interfaces, requiring zero changes to domain or application use cases.

## Consequences
- **Positive:** Instantaneous dev startup (`npm run dev`) with no local Postgres or Docker daemon requirement.
- **Positive:** Unit, integration, and e2e Playwright tests run in seconds without DB teardown/setup overhead.
- **Positive:** Clean architecture separation is strictly enforced, preventing SQL leakage into domain models.
- **Negative:** Data mutations in Phase A are volatile across server process restarts, though a "Reset to Seed Scenario" button provides predictable state restoration for demos.
