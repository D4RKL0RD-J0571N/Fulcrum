# ADR-001: Simulation Engine Boundary and TypeScript-First Adapter

## Status
Accepted

## Context
Fulcrum is a simulation-first platform requiring high-fidelity discrete-event evaluation of warehouse fulfillment strategies. In production (Phase B), execution will be handled by a high-throughput, containerized C#/.NET 8 worker process. However, for Phase A (Showcase slice), the entire system must run locally, reliably, and offline for executive demonstrations without external runtime dependencies (such as Docker or a local .NET SDK).

## Decision
1. We define a strict, versioned input/output contract (`docs/SIMULATION_CONTRACT.md`) backed by Zod schemas in `packages/sim-engine`.
2. For Phase A, we implement the simulation engine as a pure TypeScript discrete-event simulator inside the monorepo.
3. The simulation engine will be treated as an adapter behind an abstract interface (`SimulationEngineService`).
4. In Phase B, the TypeScript adapter will be replaced or supplemented by an HTTP/Worker client targeting the containerized C# worker, evaluated against the exact same golden-file fixtures (`tests/fixtures/sim-golden/`).
5. We will not maintain two divergent simulation engines long-term.

## Consequences
- **Positive:** Phase A is 100% locally runnable, cross-platform, deterministic, and has zero external binary prerequisites.
- **Positive:** Unit and property tests can run instantaneously in Vitest.
- **Negative:** The simulation logic will need to be ported to C# in Phase B, though the strict contract, golden test cases, and domain abstractions ensure 1:1 behavioral parity.
