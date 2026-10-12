import { describe, it, expect } from 'vitest';
import { PureTypeScriptSimulationEngine } from '../src/index';
import { SimulationInputSnapshot } from '@fulcrum/contracts';

describe('M8 Scalability & Performance Benchmarks', () => {
  function generateBenchmarkSnapshot(orderCount: number, locationCount: number): SimulationInputSnapshot {
    const locations = Array.from({ length: locationCount }, (_, i) => ({
      id: `loc_${i}`,
      x: (i % 50) * 1.5,
      y: Math.floor(i / 50) * 2.5,
      z: (i % 4) * 1.5,
      access_type: (i % 4 === 3 ? 'forklift' : 'manual') as 'forklift' | 'manual',
      capacity: 2,
      is_blocked: false
    }));

    const inventory = Array.from({ length: locationCount * 2 }, (_, i) => ({
      mu_id: `${100000 + (i % 5000)}`,
      location_id: `loc_${i % locationCount}`,
      sku: `SKU_${1000 + (i % 300)}`,
      quantity_units: 12
    }));

    const orders = Array.from({ length: orderCount }, (_, i) => ({
      order_id: `ORD_${i.toString().padStart(9, '0')}`,
      arrival_time: i * 30,
      deadline: i * 30 + 3600,
      priority: i % 10 === 0 ? ('HIGH' as const) : ('STANDARD' as const),
      items: [
        {
          line_id: `l_${i}_1`,
          sku: `SKU_${1000 + (i % 300)}`,
          quantity_units: 1
        },
        {
          line_id: `l_${i}_2`,
          sku: `SKU_${1000 + ((i + 1) % 300)}`,
          quantity_units: 2
        }
      ]
    }));

    return {
      contract_version: '1.0.0',
      snapshot_id: `bench_${orderCount}`,
      snapshot_hash: `hash_${orderCount}`,
      workspace_id: 'ws_default',
      seed: 42,
      config: {
        start_time_seconds: 0,
        duration_seconds: 86400,
        strategy: 'BATCH_WAVE_ROUTING'
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
      locations,
      inventory,
      workload: { orders, replenishment_triggers: [] },
      resources: { manual_pickers: [], forklifts: [] }
    };
  }

  it('executes 1,000 orders across 2,000 locations under 500ms in TypeScript', () => {
    const engine = new PureTypeScriptSimulationEngine();
    const snapshot = generateBenchmarkSnapshot(1000, 2000);

    const start = performance.now();
    const result = engine.executeRun(snapshot);
    const duration = performance.now() - start;

    expect(result.summary_metrics.total_orders).toBe(1000);
    expect(result.summary_metrics.fulfilled_orders).toBe(1000);
    expect(duration).toBeLessThan(500); // Sub-500ms execution
  });

  it('measures p50/p95 latency stability across consecutive simulation runs', () => {
    const engine = new PureTypeScriptSimulationEngine();
    const snapshot = generateBenchmarkSnapshot(500, 1000);
    const timings: number[] = [];

    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      engine.executeRun(snapshot);
      timings.push(performance.now() - start);
    }

    timings.sort((a, b) => a - b);
    const p50 = timings[Math.floor(timings.length * 0.5)];
    const p95 = timings[Math.floor(timings.length * 0.95)];

    expect(p50).toBeLessThan(200);
    expect(p95).toBeLessThan(350);
  });
});
