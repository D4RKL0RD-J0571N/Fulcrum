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

describe('PureTypeScriptSimulationEngine', () => {
  const mockSnapshot: SimulationInputSnapshot = {
    contract_version: '1.0.0',
    snapshot_id: 'snap_test_01',
    snapshot_hash: 'hash_test_123',
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
      forklift_speed_mps: 2.0
    },
    locations: [
      { id: 'loc_01', x: 2, y: 5, z: 0.5, access_type: 'manual', capacity: 2, is_blocked: false },
      { id: 'loc_02', x: 2, y: 5, z: 4.5, access_type: 'forklift', capacity: 2, is_blocked: false }
    ],
    inventory: [
      { mu_id: 'mu_1', location_id: 'loc_01', sku: 'SKU-A', quantity: 50 },
      { mu_id: 'mu_2', location_id: 'loc_02', sku: 'SKU-B', quantity: 100 }
    ],
    workload: {
      orders: [
        {
          order_id: 'ord_1',
          arrival_time: 10,
          deadline: 1200,
          priority: 'STANDARD',
          items: [{ sku: 'SKU-A', quantity: 2 }]
        },
        {
          order_id: 'ord_2',
          arrival_time: 20,
          deadline: 1200,
          priority: 'HIGH',
          items: [{ sku: 'SKU-B', quantity: 5 }]
        }
      ],
      replenishment_triggers: []
    },
    resources: {
      manual_pickers: [{ id: 'pkr_1', name: 'Picker 1', speed_mps: 1.2 }],
      forklifts: [{ id: 'flt_1', name: 'Forklift 1', speed_mps: 2.0 }]
    }
  };

  it('generates reproducible results for the same seed', () => {
    const engine = new PureTypeScriptSimulationEngine();
    const res1 = engine.executeRun(mockSnapshot);
    const res2 = engine.executeRun(mockSnapshot);

    expect(res1.summary_metrics).toEqual(res2.summary_metrics);
    expect(res1.summary_metrics.fulfilled_orders).toBe(2);
  });

  it('demonstrates reduced contention delays under CONGESTION_AWARE strategy', () => {
    const engine = new PureTypeScriptSimulationEngine();
    const baselineRes = engine.executeRun(mockSnapshot);

    const alternativeSnapshot: SimulationInputSnapshot = {
      ...mockSnapshot,
      config: { ...mockSnapshot.config, strategy: 'CONGESTION_AWARE' }
    };
    const altRes = engine.executeRun(alternativeSnapshot);

    expect(altRes.summary_metrics.total_congestion_delay_seconds).toBeLessThan(
      baselineRes.summary_metrics.total_congestion_delay_seconds
    );
  });
});
