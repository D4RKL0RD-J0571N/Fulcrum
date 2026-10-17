# Fulcrum — Domain Model Specification

## 1. Domain Overview

Fulcrum's primary operational domain is defined in `@fulcrum/domain` (`packages/domain/src/planning.ts`). It models order-specific material demand, offline stock observations, physical container (Manipulation Unit) consolidation, and operational safety constraints.

```text
+-----------------------------------------------------------------------------+
|                                    Order                                    |
|  - orderId: string                                                          |
|  - priority: 'CRITICAL' | 'HIGH' | 'STANDARD' | 'LOW'                       |
|  - lines: OrderRequirementLine[]                                            |
|    - lineId, materialSku, materialName, requestedQuantity                   |
+-----------------------------------------------------------------------------+
                                      │
                                      ▼
+-----------------------------------------------------------------------------+
|                            OrderMaterialPlanner                             |
|  - calculatePlan(orders, selectedIds, observations, options): PlanningRun   |
+-----------------------------------------------------------------------------+
                                      ▲
                                      │
+-----------------------------------------------------------------------------+
|                               StockObservation                              |
|  - observationId, materialSku, observedQuantity                             |
|  - location?: string, muId?: string, observedAt: number, notes?: string     |
|  - resolveCurrentObservations(observations): StockObservation[]             |
+-----------------------------------------------------------------------------+
                                      │
                                      ▼
+-----------------------------------------------------------------------------+
|                                 PlanningRun                                 |
|  - runId, calculatedAt, selectedOrderIds, activeObservations                |
|  - tasks: ManipulationUnitPickTask[]                                        |
|    - muId?: string, location?: string                                       |
|    - hasLocationConflict: boolean, conflictingLocations?: string[]          |
|    - isLooseStock: boolean                                                  |
|    - extractions: OrderMaterialExtractionLine[]                             |
|  - orderSummaries: OrderFulfillmentSummary[]                                |
|  - summary: PlanningSummary                                                 |
|    - totalRequestedPieces, totalAllocatedPieces, totalShortagePieces        |
|    - totalDistinctMUsToCollect (excludes loose stock)                       |
|    - hasLooseStock, hasUnresolvedConflicts, isPlanExecutable                |
|  - warnings: PlanningWarning[]                                              |
+-----------------------------------------------------------------------------+
```

---

## 2. Core Entities & Value Objects

### 2.1 Order & OrderRequirementLine
Represents customer demand imported from desk-side views ("Visualize Order"):
```typescript
export interface OrderRequirementLine {
  lineId: string;
  materialSku: string;
  materialName?: string;
  requestedQuantity: number;
}

export interface Order {
  orderId: string;
  priority: 'CRITICAL' | 'HIGH' | 'STANDARD' | 'LOW';
  createdAt: number;
  notes?: string;
  lines: OrderRequirementLine[];
}
```

### 2.2 StockObservation & Resolution
Represents point-in-time inventory reports entered from "Visualize Material":
```typescript
export interface StockObservation {
  observationId: string;
  muId?: string;           // 6-digit physical container ID (e.g. '502900')
  materialSku: string;     // 10-digit material code (e.g. '1524289001')
  observedQuantity: number;// On-hand piece count
  location?: string;       // Warehouse bay/bin coordinate (e.g. 'EC07A')
  observedAt: number;      // Unix timestamp in milliseconds
  notes?: string;
}
```

#### Observation Resolution (`resolveCurrentObservations`)
To prevent double-counting when observations are refreshed:
1. Normalizes keys: `locKey = normalizeLocationKey(obs.location)` and `muKey = normalizeMuKey(obs.muId)`.
2. Composite identity: `compositeKey = ${sku}::${locKey}::${muKey}`.
3. Superseding rule: when multiple observations match the composite key, only the observation with the most recent `observedAt` is retained.
4. Independent location contribution: observations with differing locations (or differing MUs) do not collide and contribute separate quantities to available stock.

---

## 3. Planning Aggregates & Output Contracts

### 3.1 ManipulationUnitPickTask
Represents one physical collection job for the warehouse picker:
```typescript
export interface ManipulationUnitPickTask {
  taskId: string;
  muId?: string;                       // Undefined for loose stock
  location?: string;                   // Canonical resolved location or conflict string
  hasLocationConflict?: boolean;       // True if observed in multiple distinct locations
  conflictingLocations?: string[];     // Array of distinct reported locations
  isLooseStock: boolean;               // True if uncontainerized
  extractions: OrderMaterialExtractionLine[];
}

export interface OrderMaterialExtractionLine {
  orderId: string;
  lineId: string;
  materialSku: string;
  materialName?: string;
  quantityToExtract: number;
  observationId: string;
}
```

#### Key Invariants:
1. **Container Sharing**: Multiple SKU extractions from the same physical container are grouped into a single task.
2. **Multi-Order Grouping**: Multiple orders needing items from the same MU are co-located in the same task card.
3. **Traceability**: Every extraction line explicitly names the target `orderId`, source `observationId`, `materialSku`, and exact `quantityToExtract`.

### 3.2 PlanningSummary & Physical Unit Counts
```typescript
export interface PlanningSummary {
  totalRequestedPieces: number;
  totalAllocatedPieces: number;
  totalShortagePieces: number;
  totalDistinctMUsToCollect: number;   // Count of distinct physical MUs (loose stock excluded)
  hasLooseStock: boolean;
  hasUnresolvedConflicts: boolean;
  conflictingMuCount: number;
  isPlanExecutable: boolean;
}
```

#### Key Invariants:
1. **Physical MU vs. Piece Count**: `totalDistinctMUsToCollect` reflects physical containers only. If 3 MUs supply 18 pieces, `totalDistinctMUsToCollect === 3` and `totalAllocatedPieces === 18`.
2. **Loose Stock Exclusion**: Loose stock (`isLooseStock: true`) contributes to piece counts but does not increment `totalDistinctMUsToCollect`.

---

## 4. Operational Safety Invariants

### 4.1 MU Location Conflict Guard
```typescript
// Conflict Evaluation Rule:
if (isContainerizedMU) {
  const distinctKnownLocations = Array.from(new Set(
    observationsForMU.map(o => normalizeLocationKey(o.location)).filter(l => l !== 'UNSPECIFIED')
  ));

  if (distinctKnownLocations.length > 1) {
    // Flag Conflict:
    hasLocationConflict = true;
    conflictingLocations = distinctKnownLocations;
    resolvedLocation = `Location Conflict (${distinctKnownLocations.join(' vs ')})`;
    plan.warnings.push({
      code: 'CONFLICTING_MU_LOCATION',
      muId,
      conflictingLocations,
      message: `MU ${muId} is reported at multiple conflicting locations...`
    });
  }
}
```

#### Invariants:
- **No Arbitrary Resolution**: The planner never silently selects one location over another.
- **Strict Singularity**: Exactly one physical MU pick task is created, preventing duplicate extraction counts.
- **Readiness Gate**: The presence of any location conflict sets `summary.isPlanExecutable = false` and `summary.hasUnresolvedConflicts = true`.

---

## 5. Foundational Monorepo Models

In addition to the order-fulfillment planner, the monorepo includes foundational layout and discrete-event simulation models:
- **`WarehouseLayout`** (`@fulcrum/domain`): Structured hierarchy (`Zone -> Row -> Column/Bay -> Level -> Platform`) with physical coordinates `(x, y, z)` and template-driven addressing.
- **`SimulationEngine`** (`@fulcrum/sim-engine`, `Fulcrum.SimWorker`): Deterministic discrete-event simulation with integer virtual time and seeded PRNG (PCG-32) for deep-bay congestion and multi-tier platform access benchmarking.
