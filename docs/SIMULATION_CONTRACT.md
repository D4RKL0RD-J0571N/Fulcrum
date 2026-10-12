# Fulcrum — Simulation Input/Output Contract

## 1. Boundary & Design Philosophy

The Fulcrum simulation engine is an independent, pure computational package.
Key design constraints:
1. **Zero UI / Storage Dependencies:** No imports from Next.js, React, Supabase, or external I/O.
2. **Zero String Parsing:** The simulation engine **never** parses location codes (e.g. `EH14D`). All locations are provided as normalized geometric points with spatial coordinates and attributes.
3. **Strict Determinism:** Identical input snapshot + identical random seed = byte-identical output across runs and engine runtimes (TypeScript and C#).

---

## 2. Input Snapshot Contract (`SimulationInputSnapshot`)

The input contract is versioned (`contract_version: "1.0.0"`) and validated via Zod schemas.

```json
{
  "contract_version": "1.0.0",
  "snapshot_id": "snap_01HZX8790",
  "snapshot_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "workspace_id": "ws_default",
  "seed": 421882,
  "config": {
    "start_time_seconds": 0,
    "duration_seconds": 28800,
    "strategy": "BASELINE" // or "CONGESTION_AWARE"
  },
  "rules": {
    "congestion_radius_meters": 2.5,
    "congestion_slowdown_factor": 0.5,
    "forklift_lockout_duration_seconds": 180,
    "picker_walking_speed_mps": 1.2,
    "forklift_speed_mps": 2.0
  },
  "locations": [
    {
      "id": "loc_001",
      "x": 1.2,
      "y": 2.5,
      "z": 0.5,
      "access_type": "manual",
      "capacity": 2,
      "is_blocked": false
    }
  ],
  "inventory": [
    {
      "mu_id": "mu_101",
      "location_id": "loc_001",
      "sku": "SKU-BLUE-M",
      "quantity": 24
    }
  ],
  "workload": {
    "orders": [
      {
        "order_id": "ord_501",
        "arrival_time": 60,
        "deadline": 3600,
        "priority": "HIGH",
        "items": [
          { "sku": "SKU-BLUE-M", "quantity": 2 }
        ]
      }
    ],
    "replenishment_triggers": [
      {
        "trigger_id": "rep_901",
        "sku": "SKU-BLUE-M",
        "threshold_quantity": 5,
        "target_location_id": "loc_001",
        "source_location_id": "loc_004"
      }
    ]
  },
  "resources": {
    "manual_pickers": [
      { "id": "pkr_01", "name": "Picker 1", "speed_mps": 1.2 }
    ],
    "forklifts": [
      { "id": "flt_01", "name": "Forklift 1", "speed_mps": 2.0 }
    ]
  }
}
```

---

## 3. Output Run Result Contract (`SimulationOutputResult`)

```json
{
  "contract_version": "1.0.0",
  "run_id": "sim_run_9942",
  "snapshot_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "strategy": "CONGESTION_AWARE",
  "seed": 421882,
  "execution_wall_time_ms": 48,
  "summary_metrics": {
    "total_orders": 120,
    "fulfilled_orders": 118,
    "late_orders": 2,
    "stock_shortages": 0,
    "total_travel_distance_meters": 14250.4,
    "average_order_cycle_time_seconds": 412.5,
    "picker_utilization_ratio": 0.84,
    "forklift_contention_events": 3,
    "total_congestion_delay_seconds": 540
  },
  "timeline_events": [
    {
      "time": 120,
      "event_type": "TASK_STARTED",
      "entity_id": "tsk_001",
      "resource_id": "pkr_01",
      "location_id": "loc_001",
      "details": { "action": "PICK", "sku": "SKU-BLUE-M" }
    }
  ],
  "bay_congestion_heatmap": [
    {
      "bay_id": "bay_H_14",
      "congestion_duration_seconds": 360,
      "incidents_count": 2
    }
  ]
}
```

---

## 4. Deterministic Simulation Invariants

1. **Deterministic Pseudo-Random Generation:** All stochastic actions (if any) or randomized tie-breaks must draw from an explicit PRNG seeded with `snapshot.seed`.
2. **Explicit Integer Virtual Clock:** Time progresses in discrete integer seconds: `virtual_now = 0, 1, 2, ...`. Real system clock (`Date.now()`, `performance.now()`) is never consulted inside the simulation loop.
3. **Deterministic Event Queue Priority:** Events scheduled at the same timestamp are popped according to a strict composite tuple key:
   $$\text{Priority Key} = (\text{timestamp}, \text{event\_priority}, \text{entity\_id})$$
4. **Golden Fixture Verification:** Golden fixtures stored under `tests/fixtures/sim-golden/` verify that both the Phase A TypeScript implementation and the Phase B C# engine yield identical metric summaries.
