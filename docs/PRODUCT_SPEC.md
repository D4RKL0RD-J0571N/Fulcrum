# Fulcrum — Product Specification

## 1. Executive Summary

**Fulcrum** is a fast, professional, desk-side order-fulfillment planning application. It is designed to be used alongside an existing warehouse billing and checkout system to help operators and warehouse pickers prepare complete, reliable, and executable physical collection plans before walking onto the warehouse floor.

Fulcrum is **not** a full warehouse simulator, live inventory tracking system (IMS), or automated warehouse execution system (WES). Instead, it operates on structured, order-specific demand and externally reported stock snapshots, consolidating demand across orders and calculating exactly which physical containers (Manipulation Units) to retrieve, which materials and quantities to extract, and what operational conflicts require resolution before floor departure.

---

## 2. Problem Statement & Operational Objective

### The Operational Challenge
In multi-tier distribution centers and high-density warehouses, workers often lose significant time returning to their desks because:
- Picking instructions were missing, ambiguous, or failed to associate items with orders.
- The plan indicated how many material pieces to pick but failed to identify the specific physical container (Manipulation Unit) holding them.
- Multiple customer orders required the same material or container, leading to redundant trips.
- Externally reported stock observations were stale or placed the same container in multiple contradictory locations.

### The Fulcrum Objective
Provide a desk-side planning tool that guarantees:
1. **Unambiguous Collection Instructions**: Tells the worker exactly which physical Manipulation Units (MUs) to collect, with their location when known.
2. **Clear Order Associations**: Specifies every material SKU and quantity required from each MU, tagged with the destination customer order.
3. **Accurate Unit Counts**: Explicitly distinguishes between the total number of physical containers to pull and the total individual pieces to extract.
4. **Pre-Floor Conflict Detection**: Flags missing data, shortages, stale observations, and conflicting MU locations *before* the worker leaves the desk.
5. **Durable Floor Utilities**: Provides a print-optimized document and an offline-capable, non-mutating checklist to consult while on the floor.

---

## 3. Core Operational Workflow

```text
  [ Desk-Side Input ]
         │
         ├── 1. Visualize Order: Enter / select customer orders and material requirements.
         │
         └── 2. Visualize Material: Enter stock observations (SKU, quantity, location, MU ID).
         │
         ▼
  [ Domain Planning Engine ]
         │
         ├── 3. Resolve Current Observations: Supersede older snapshots; detect staleness.
         │
         ├── 4. Detect MU Location Conflicts: Flag identical MUs reported in multiple locations.
         │
         ├── 5. Consolidate Demand: Group multi-order demand by shared physical MU.
         │
         └── 6. Evaluate Readiness: Mark plan executable or block with desk-side warnings.
         │
         ▼
  [ Floor Execution ]
         │
         ├── 7. Print Collection Plan: Clean @media print layout with page-break protection.
         │
         └── 8. Floor Collection Checklist: Local touch-friendly checklist (no stock mutation).
```

### 3.1 Order Intake ("Visualize Order")
- Users create or select orders requiring fulfillment.
- Each order contains line items with material SKU, human-readable description, requested quantity, and priority class (`CRITICAL`, `HIGH`, `STANDARD`, `LOW`).
- Fulcrum consolidates required quantities across all active selected orders.

### 3.2 Offline Stock Observations ("Visualize Material")
- Stock observations are snapshots of externally reported inventory from the host system.
- An observation records:
  - `observationId`: unique snapshot identifier.
  - `materialSku`: 10-digit material code.
  - `observedQuantity`: reported on-hand piece count.
  - `location`: warehouse bay/bin coordinate (e.g. `EC07A`, `EH14B`), or unspecified.
  - `muId`: 6-digit physical Manipulation Unit tracking code (e.g. `502900`), or unspecified for loose stock.
  - `observedAt`: Unix timestamp when the external observation was recorded.
  - `notes`: operator notes (e.g., "Ground platform box").

### 3.3 Observation Resolution Semantics
- Refreshed observations cleanly supersede older observations for the same material SKU, location, and MU.
- The planner uses the applicable current observation rather than summing historical observations.
- Multiple observations of the same material at different locations contribute separately to available supply.
- Unspecified-location observations are supported and handled gracefully without being falsely merged with known locations.
- Configurable freshness threshold (default 60 minutes) flags stale observations as warnings without discarding usable inventory unless configured.

### 3.4 Physical Manipulation Unit (MU) Planning
- **Container Sharing**: Multiple SKUs associated with the same MU ID aggregate into a single physical collection task.
- **Multi-Order Consolidation**: Extractions for multiple orders from the same physical container are grouped together.
- **Loose Stock Support**: Stock observed without an MU ID is treated as uncontainerized loose stock and marked with `isLooseStock = true`. It contributes to piece quantities but is **never** counted in the distinct physical MU count.
- **Traceability**: Every allocated quantity is strictly tied to its source observation, MU, SKU, and target order line.
- **Shortage Reporting**: If available stock is insufficient to fulfill an order line, the deficit is explicitly reported at the line level.

### 3.5 Operational Safety & Conflict Detection
- **MU Location Conflict**: An MU cannot legitimately exist in two places at once. If observations associate the same MU ID with multiple distinct, non-empty locations, the planner:
  - Emits a `CONFLICTING_MU_LOCATION` warning with all conflicting locations listed.
  - Sets `hasLocationConflict = true` and `conflictingLocations` on the pick task.
  - **Preserves Singularity**: Keeps exactly one physical MU pick task and counts it exactly once.
  - **Refuses Silent Resolution**: Never guesses or arbitrarily picks one location.
  - **Guards Readiness**: Sets `isPlanExecutable = false` and `hasUnresolvedConflicts = true`, alerting the operator to resolve the discrepancy before floor dispatch.
- **Tolerance**: A known location plus an unspecified location for an MU is treated as incomplete data, not a location conflict.

### 3.6 Floor Collection & Checklist
- **Print Optimization**: High-contrast, clean print styles (`@media print`) omitting web controls, navigation, and input forms.
- **Floor Checklist**: Interactive task-level and line-level checkboxes. State is stored in browser `localStorage` keyed by `runId`. Checking tasks **never** decrements inventory, mutates observations, or triggers plan recalculations.

---

## 4. Scope Boundaries & Explicit Non-Goals

To maintain focus, reliability, and security, Fulcrum strictly defines what is out of scope:
- **No AI / Automated Bots**: No AI agents, transcription, OCR, or automated bots interacting with live inventory records.
- **No Host Network Scrapers**: No direct scraping, clipboard injection, or network access to host billing systems.
- **No Live Inventory Ledger Mutations**: Fulcrum does not act as the authoritative transactional inventory ledger. Observations are treated as external read-only snapshots.
- **No Routing Speed Optimization**: No speculative walking-speed heuristics, floor traffic meters, or picker productivity tracking.

---

## 5. Non-Functional Requirements

- **Reliability & Determinism**: 100% deterministic plan calculation given the same selected orders and observations.
- **Speed**: Calculation latency under 20ms for dozens of orders and hundreds of observations.
- **Offline Usability**: All planning calculations run locally in the client/domain layer with zero network requirements.
- **Accessibility & Theme**: Professional high-contrast dark and light themes, legible tabular numbers, and full keyboard navigation.
