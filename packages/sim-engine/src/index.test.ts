import { describe, it, expect } from 'vitest';
import {
  PureTypeScriptSimulationEngine,
  DeterministicPRNG
} from './index';
import { SimulationInputSnapshot } from '@fulcrum/contracts';

describe('DeterministicPRNG', () => {
  it('produces identical pseudo-random sequence for identical seed', () => {
    const prng1 = new DeterministicPRNG(1337);
    const prng2 = new DeterministicPRNG(1337);

    const seq1 = [prng1.nextFloat(), prng1.nextFloat(), prng1.nextInt(1, 100)];
    const seq2 = [prng2.nextFloat(), prng2.nextFloat(), prng2.nextInt(1, 100)];

    expect(seq1).toEqual(seq2);
  });
});

describe('PureTypeScriptSimulationEngine with Redundant MU Trips & Single Units', () => {
  const mockSnapshot: SimulationInputSnapshot = {
    contract_version: '1.0.0',
    snapshot_id: 'snap_test_mu_01',
    snapshot_hash: 'hash_test_mu_123',
    workspace_id: 'ws_default',
    seed: 42,
    config: {
      start_time_seconds: 0,
      duration_seconds: 7200,
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
      { id: 'loc_01', x: 2, y: 5, z: 0.5, access_type: 'manual', capacity: 2, is_blocked: false }
    ],
    inventory: [
      // Same MU holds size variants 001 and 002
      { mu_id: 'mu_box_01', location_id: 'loc_01', sku: '1524289001', quantity_units: 50 },
      { mu_id: 'mu_box_01', location_id: 'loc_01', sku: '1524289002', quantity_units: 30 }
    ],
    workload: {
      orders: [
        {
          order_id: '000815296',
          arrival_time: 10,
          deadline: 1200,
          priority: 'STANDARD',
          items: [{ line_id: 'l1', sku: '1524289001', quantity_units: 1 }]
        },
        {
          // Next order also requests from mu_box_01
          order_id: '000815297',
          arrival_time: 20,
          deadline: 1200,
          priority: 'HIGH',
          items: [{ line_id: 'l2', sku: '1524289002', quantity_units: 1 }]
        }
      ],
      replenishment_triggers: []
    },
    resources: {
      manual_pickers: [{ id: 'pkr_1', name: 'Picker 1', speed_mps: 1.2 }],
      forklifts: [{ id: 'flt_1', name: 'Forklift 1', speed_mps: 2.0 }]
    }
  };

  it('detects redundant MU trips in baseline strategy', () => {
    const engine = new PureTypeScriptSimulationEngine();
    const res = engine.executeRun(mockSnapshot);

    expect(res.summary_metrics.redundant_mu_trips).toBe(1);
    expect(res.summary_metrics.platform_extraction_events).toBe(2);
  });

  it('eliminates redundant MU trips in BATCH_WAVE_ROUTING strategy', () => {
    const engine = new PureTypeScriptSimulationEngine();
    const batchSnapshot: SimulationInputSnapshot = {
      ...mockSnapshot,
      config: { ...mockSnapshot.config, strategy: 'BATCH_WAVE_ROUTING' }
    };
    const res = engine.executeRun(batchSnapshot);

    expect(res.summary_metrics.redundant_mu_trips).toBe(0);
    expect(res.summary_metrics.total_travel_distance_meters).toBeLessThan(
      mockSnapshot.locations[0].x * 10 // much shorter travel
    );
  });
});
