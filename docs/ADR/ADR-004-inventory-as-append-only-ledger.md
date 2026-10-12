# ADR-004: Inventory as an Append-Only Ledger

## Status
Accepted

## Context
Traditional CRUD systems maintain inventory as mutable quantities on location rows (e.g., `UPDATE stock SET quantity = quantity - 5`). This leads to concurrency race conditions, lack of auditability, inability to diagnose historical stock anomalies, and irreproducible simulation snapshots.

## Decision
1. All physical inventory changes in Fulcrum are represented as immutable `StockMovement` ledger records.
2. Every ledger entry requires an `idempotency_key`, `workspace_id`, timestamp, SKU, quantity, and source/target locations.
3. Current available stock and location occupancies are read projections derived by aggregating the ledger.
4. Stock reservations are distinct records evaluated atomically against current unreserved on-hand balance.
5. In Phase A, the ledger is maintained in an in-memory event-sourced store. In Phase B, it is backed by an append-only PostgreSQL table with strict RLS and audit triggers.

## Consequences
- **Positive:** Complete, immutable audit trail of every warehouse movement.
- **Positive:** Idempotent operations prevent double-picking and duplicate stock replenishment.
- **Positive:** Simulation runs can construct point-in-time inventory snapshots with 100% fidelity.
- **Negative:** Requires projection recalculation or cached balance tables for fast dashboard reads (implemented in Phase B via indexed materialized views).
