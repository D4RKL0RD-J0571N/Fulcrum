import { describe, it, expect } from 'vitest';
import { PureTypeScriptSimulationEngine } from './index';
import { SimulationInputSnapshot } from '@fulcrum/contracts';

describe('Deterministic Golden-File Fixture Verification', () => {
  const goldenSnapshot: SimulationInputSnapshot = {
    contract_version: '1.0.0',
    snapshot_id: 'snap_golden_01',
    snapshot_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    workspace_id: 'ws_default',
    seed: 48213,
    config: {
      start_time_seconds: 0,
      duration_seconds: 28800,
      strategy: 'BASELINE'
    },
    rules: {
      congestion_radius_meters: 2.5,
      congestion_slowdown_factor: 0.5,
      forklift_lockout_duration_seconds: 180,
      picker_walking_speed_mps: 1.2,
      forklift_speed_mps: 2.0,
      platform_draw_penalty_seconds: 18,
      box_shuffle_penalty_seconds: 25,
      piece_pick_seconds: 6
    },
    locations: [
      { id: 'loc_EH14A', x: 16.8, y: 17.5, z: 0.5, access_type: 'manual', capacity: 2, is_blocked: false },
      { id: 'loc_EH14B', x: 16.8, y: 17.5, z: 2.0, access_type: 'manual', capacity: 2, is_blocked: false },
      { id: 'loc_EH14D', x: 16.8, y: 17.5, z: 5.5, access_type: 'forklift', capacity: 2, is_blocked: false },
      { id: 'loc_EC07A', x: 8.4, y: 5.0, z: 0.5, access_type: 'manual', capacity: 2, is_blocked: false }
    ],
    inventory: [
      { mu_id: '502900', location_id: 'loc_EH14A', sku: '1524289001', quantity_units: 6 },
      { mu_id: '502900', location_id: 'loc_EH14A', sku: '1524289002', quantity_units: 5 },
      { mu_id: '101003', location_id: 'loc_EH14D', sku: '1524289004', quantity_units: 6 },
      { mu_id: '202005', location_id: 'loc_EC07A', sku: '1524289001', quantity_units: 12 }
    ],
    workload: {
      orders: [
        {
          order_id: '000815296',
          arrival_time: 0,
          deadline: 3600,
          priority: 'HIGH',
          items: [{ line_id: 'l1', sku: '1524289001', quantity_units: 1 }]
        },
        {
          order_id: '000815297',
          arrival_time: 60,
          deadline: 3600,
          priority: 'HIGH',
          items: [{ line_id: 'l2', sku: '1524289002', quantity_units: 1 }]
        },
        {
          order_id: '000815298',
          arrival_time: 120,
          deadline: 3600,
          priority: 'STANDARD',
          items: [{ line_id: 'l3', sku: '1524289004', quantity_units: 1 }]
        }
      ],
      replenishment_triggers: []
    },
    resources: {
      manual_pickers: [{ id: 'pkr_01', name: 'Picker 1', speed_mps: 1.2 }],
      forklifts: [{ id: 'flt_01', name: 'Forklift 1', speed_mps: 2.0 }]
    }
  };

  it('produces byte-identical baseline results across repeated runs with identical seed', () => {
    const engine = new PureTypeScriptSimulationEngine();
    const runA = engine.executeRun(goldenSnapshot);
    const runB = engine.executeRun(goldenSnapshot);

    expect(runA.summary_metrics).toEqual(runB.summary_metrics);
    expect(runA.summary_metrics.total_orders).toBe(3);
    expect(runA.summary_metrics.fulfilled_orders).toBe(3);
    expect(runA.summary_metrics.late_orders).toBe(0);
    expect(runA.summary_metrics.stock_shortages).toBe(0);
    expect(runA.summary_metrics.redundant_mu_trips).toBe(1);
    expect(runA.summary_metrics.platform_extraction_events).toBe(2);
    expect(runA.summary_metrics.forklift_contention_events).toBe(1);
  });

  it('demonstrates that batch wave routing eliminates redundant MU trips in golden fixture', () => {
    const engine = new PureTypeScriptSimulationEngine();
    const batchSnapshot: SimulationInputSnapshot = {
      ...goldenSnapshot,
      config: { ...goldenSnapshot.config, strategy: 'BATCH_WAVE_ROUTING' }
    };
    const batchRun = engine.executeRun(batchSnapshot);

    expect(batchRun.summary_metrics.redundant_mu_trips).toBe(0);
    expect(batchRun.summary_metrics.total_travel_distance_meters).toBeLessThan(
      engine.executeRun(goldenSnapshot).summary_metrics.total_travel_distance_meters
    );
  });
});
