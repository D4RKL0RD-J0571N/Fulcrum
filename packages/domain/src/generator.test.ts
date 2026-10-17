import { describe, it, expect } from 'vitest';
import {
  generateSyntheticWarehouseData,
  buildSimulationSnapshotFromDataset,
  RETAIL_PRODUCT_CATALOG
} from './generator';
import {
  DEMONSTRATION_SCENARIOS,
  getScenario,
  getAllScenarios
} from './scenarios';
import {
  OrderMaterialPlanner,
  resolveCurrentObservations
} from './planning';
import { PureTypeScriptSimulationEngine } from '@fulcrum/sim-engine';

describe('Deterministic Synthetic Retail Dataset & Generator', () => {
  const seed = 48213;
  const dataset = generateSyntheticWarehouseData({ seed });

  it('1. guarantees determinism: identical seed produces identical dataset', () => {
    const dataset2 = generateSyntheticWarehouseData({ seed });
    expect(dataset.orders).toEqual(dataset2.orders);
    expect(dataset.observations).toEqual(dataset2.observations);
    expect(dataset.muIds).toEqual(dataset2.muIds);
    expect(dataset.locations).toEqual(dataset2.locations);
    expect(dataset.stats).toEqual(dataset2.stats);
  });

  it('2. generates realistic catalog meeting target size constraints', () => {
    // Target: 40-60 base products, 80-150 SKU variants
    expect(RETAIL_PRODUCT_CATALOG.length).toBeGreaterThanOrEqual(40);
    expect(RETAIL_PRODUCT_CATALOG.length).toBeLessThanOrEqual(60);

    const totalVariants = RETAIL_PRODUCT_CATALOG.reduce((sum, p) => sum + p.variants.length, 0);
    expect(totalVariants).toBeGreaterThanOrEqual(80);
    expect(totalVariants).toBeLessThanOrEqual(150);
  });

  it('3. enforces 6-character alphanumeric uniqueness for all MU identifiers', () => {
    const muRegex = /^[0-9A-Z]{6}$/;
    const muSet = new Set<string>();

    for (const muId of dataset.muIds) {
      expect(muId).toMatch(muRegex);
      expect(muSet.has(muId)).toBe(false);
      muSet.add(muId);
    }

    expect(dataset.muIds.length).toBeGreaterThanOrEqual(100);
    expect(dataset.muIds.length).toBeLessThanOrEqual(180);
  });

  it('4. ensures pack-to-piece internal quantity consistency in containerized MUs', () => {
    const skuMap = new Map<string, (typeof dataset.allVariants)[0]>();
    for (const v of dataset.allVariants) {
      skuMap.set(v.sku, v);
    }

    for (const obs of dataset.observations) {
      if (obs.muId) {
        const variant = skuMap.get(obs.materialSku);
        expect(variant).toBeDefined();
        if (variant && variant.piecesPerPack > 1) {
          // Observed piece quantity must be a positive multiple of the pack size
          expect(obs.observedQuantity % variant.piecesPerPack).toBe(0);
        }
      }
    }
  });

  it('5. enforces location singularity: no MU assigned to multiple locations in consistent snapshot', () => {
    const muLocations = new Map<string, string>();
    for (const obs of dataset.observations) {
      if (!obs.muId) continue;
      const loc = obs.location?.trim().toUpperCase();
      if (!loc) continue;

      if (!muLocations.has(obs.muId)) {
        muLocations.set(obs.muId, loc);
      } else {
        expect(muLocations.get(obs.muId)).toBe(loc);
      }
    }
  });

  it('6. distinguishes physical MUs from loose/uncontainerized stock', () => {
    const looseObservations = dataset.observations.filter(o => !o.muId);
    expect(looseObservations.length).toBeGreaterThan(0);

    const containerized = dataset.observations.filter(o => !!o.muId);
    expect(containerized.length).toBeGreaterThan(looseObservations.length);

    // Plan against a mixed batch of containerized and loose stock
    const testOrders = dataset.orders.slice(0, 5);
    const selectedIds = testOrders.map(o => o.orderId);
    const plan = OrderMaterialPlanner.calculatePlan(testOrders, selectedIds, dataset.observations);

    // Physical MU count must reflect containers only (!isLoose)
    const expectedMuCount = plan.pickList.filter(t => !t.isLoose).length;
    expect(plan.summary.totalManipulationUnitsToCollect).toBe(expectedMuCount);

    // Total pieces allocated must be >= distinct MU count
    expect(plan.summary.totalPiecesAllocated).toBeGreaterThanOrEqual(plan.summary.totalManipulationUnitsToCollect);
  });

  it('7. never allocates more stock than observed in active observations', () => {
    const testOrders = dataset.orders.slice(0, 10);
    const selectedIds = testOrders.map(o => o.orderId);
    const plan = OrderMaterialPlanner.calculatePlan(testOrders, selectedIds, dataset.observations);

    const activeObs = resolveCurrentObservations(dataset.observations);
    const maxStockBySku = new Map<string, number>();
    for (const obs of activeObs) {
      maxStockBySku.set(obs.materialSku, (maxStockBySku.get(obs.materialSku) || 0) + obs.observedQuantity);
    }

    for (const demand of plan.aggregatedDemand) {
      const maxAvailable = maxStockBySku.get(demand.materialSku) || 0;
      expect(demand.totalAllocated).toBeLessThanOrEqual(maxAvailable);
    }
  });
});

describe('10 Named Demonstration Scenarios Verification', () => {
  it('loads all 10 demonstration scenarios independently', () => {
    expect(DEMONSTRATION_SCENARIOS.length).toBe(10);
    const all = getAllScenarios();
    expect(all.length).toBe(10);

    for (const scen of DEMONSTRATION_SCENARIOS) {
      expect(scen.id).toBeDefined();
      expect(scen.name).toBeDefined();
      expect(scen.orders.length).toBeGreaterThan(0);
      expect(scen.selectedOrderIds.length).toBeGreaterThan(0);
    }
  });

  it('Scenario 1: Normal Fulfillment executes cleanly with zero shortages or warnings', () => {
    const sc = getScenario('normal-fulfillment')!;
    expect(sc).toBeDefined();

    const plan = OrderMaterialPlanner.calculatePlan(sc.orders, sc.selectedOrderIds, sc.observations, sc.options);
    expect(plan.summary.isPlanExecutable).toBe(true);
    expect(plan.summary.totalPiecesShortage).toBe(0);
    expect(plan.summary.hasUnresolvedConflicts).toBe(false);
    expect(plan.warnings.length).toBe(0);
    expect(plan.shortages.length).toBe(0);
  });

  it('Scenario 2: Shared MU consolidates multi-order demand into 1 collection task', () => {
    const sc = getScenario('shared-mu')!;
    expect(sc).toBeDefined();

    const plan = OrderMaterialPlanner.calculatePlan(sc.orders, sc.selectedOrderIds, sc.observations, sc.options);
    expect(plan.summary.totalManipulationUnitsToCollect).toBe(1);
    expect(plan.pickList.length).toBe(1);

    const task = plan.pickList[0];
    expect(task.muId).toBe('502900');
    expect(task.fulfillingOrderIds.sort()).toEqual(['000815296', '000815297']);
    expect(task.totalPieces).toBe(9); // (2+3) Size S + (2+2) Size M = 9 pieces
    expect(plan.summary.isPlanExecutable).toBe(true);
  });

  it('Scenario 3: Multi-MU Order fulfills 1 order across 3 distinct physical MUs', () => {
    const sc = getScenario('multi-mu-order')!;
    expect(sc).toBeDefined();

    const plan = OrderMaterialPlanner.calculatePlan(sc.orders, sc.selectedOrderIds, sc.observations, sc.options);
    expect(plan.summary.totalManipulationUnitsToCollect).toBe(3);
    expect(plan.pickList.length).toBe(3);

    const muIds = plan.pickList.map(t => t.muId).sort();
    expect(muIds).toEqual(['502900', 'A19B72', 'B44C19']);
    expect(plan.summary.totalPiecesShortage).toBe(0);
    expect(plan.summary.isPlanExecutable).toBe(true);
  });

  it('Scenario 4: Shortage reports partial and total shortages with line-level reasons', () => {
    const sc = getScenario('shortage')!;
    expect(sc).toBeDefined();

    const plan = OrderMaterialPlanner.calculatePlan(sc.orders, sc.selectedOrderIds, sc.observations, sc.options);
    expect(plan.summary.totalPiecesShortage).toBe(9); // 5 short on line 1 + 4 short on line 2
    expect(plan.shortages.length).toBe(2);

    const partialShort = plan.shortages.find(s => s.materialSku === '1524295001')!;
    expect(partialShort.reason).toBe('INSUFFICIENT_OBSERVED_STOCK');
    expect(partialShort.shortageQuantity).toBe(5);

    const totalShort = plan.shortages.find(s => s.materialSku === '1524292001')!;
    expect(totalShort.reason).toBe('NO_OBSERVATIONS');
    expect(totalShort.shortageQuantity).toBe(4);
  });

  it('Scenario 5: Conflicting MU Location halts execution readiness and preserves 1 MU count', () => {
    const sc = getScenario('conflicting-mu-location')!;
    expect(sc).toBeDefined();

    const plan = OrderMaterialPlanner.calculatePlan(sc.orders, sc.selectedOrderIds, sc.observations, sc.options);
    expect(plan.summary.hasUnresolvedConflicts).toBe(true);
    expect(plan.summary.isPlanExecutable).toBe(false);
    expect(plan.summary.totalManipulationUnitsToCollect).toBe(1); // Exactly 1 MU, not duplicated!

    const conflictTask = plan.pickList[0];
    expect(conflictTask.hasLocationConflict).toBe(true);
    expect(conflictTask.conflictingLocations).toEqual(['EC07A', 'EH14B']);
    expect(conflictTask.location).toContain('Location Conflict (EC07A vs EH14B)');

    const conflictWarn = plan.warnings.find(w => w.code === 'CONFLICTING_MU_LOCATION');
    expect(conflictWarn).toBeDefined();
  });

  it('Scenario 6: Known and Unspecified Location flags incomplete data without false conflict', () => {
    const sc = getScenario('known-and-unspecified-location')!;
    expect(sc).toBeDefined();

    const plan = OrderMaterialPlanner.calculatePlan(sc.orders, sc.selectedOrderIds, sc.observations, sc.options);
    expect(plan.summary.hasUnresolvedConflicts).toBe(false);
    expect(plan.summary.isPlanExecutable).toBe(true);

    const unlocTask = plan.pickList.find(t => t.isUnspecifiedLocation);
    expect(unlocTask).toBeDefined();
    expect(unlocTask?.isLoose).toBe(true);

    const unlocWarn = plan.warnings.find(w => w.code === 'UNSPECIFIED_LOCATION');
    expect(unlocWarn).toBeDefined();
  });

  it('Scenario 7: Level D Forklift and Bay Lockout flags intervention and clears when unlocked', () => {
    const sc = getScenario('level-d-lockout')!;
    expect(sc).toBeDefined();

    // 7A: When EH14 is locked out and restrictForkliftLocations is active
    const lockedPlan = OrderMaterialPlanner.calculatePlan(sc.orders, sc.selectedOrderIds, sc.observations, sc.options);
    expect(lockedPlan.summary.isPlanExecutable).toBe(false);
    expect(lockedPlan.summary.hasRestrictedLocations).toBe(true);
    expect(lockedPlan.summary.restrictedTaskCount).toBe(2);

    const bayLockWarn = lockedPlan.warnings.find(w => w.code === 'BAY_LOCKED_OUT');
    expect(bayLockWarn).toBeDefined();
    expect(bayLockWarn?.bay).toBe('EH14');

    const forkliftWarn = lockedPlan.warnings.find(w => w.code === 'LEVEL_D_RESTRICTED');
    expect(forkliftWarn).toBeDefined();

    // 7B: When alternative accessible stock exists in another bay, planner redirects
    const obsWithAlternative = [
      ...sc.observations,
      {
        observationId: 'obs_alt_01',
        muId: '999888',
        materialSku: '2841920001',
        observedQuantity: 5,
        location: 'EA01A', // Manually accessible in unlocked bay EA01!
        observedAt: sc.options.referenceTime! - 10 * 60 * 1000,
        notes: 'Alternative accessible stock'
      }
    ];

    const redirectPlan = OrderMaterialPlanner.calculatePlan(sc.orders, sc.selectedOrderIds, obsWithAlternative, sc.options);
    // Cargo Trousers should be redirected to MU 999888 in EA01A rather than locked bay EH14B!
    const trouserTask = redirectPlan.pickList.find(t => t.items.some(i => i.materialSku === '2841920001'))!;
    expect(trouserTask.muId).toBe('999888');
    expect(trouserTask.location).toBe('EA01A');
    expect(trouserTask.accessRestriction).toBe('NONE');

    // 7C: When lockout is cleared, bay EH14 becomes fully accessible
    const clearedOptions = {
      ...sc.options,
      lockedOutBays: [], // Lockout cleared!
      restrictForkliftLocations: false
    };
    const clearedPlan = OrderMaterialPlanner.calculatePlan(sc.orders, sc.selectedOrderIds, sc.observations, clearedOptions);
    expect(clearedPlan.summary.hasRestrictedLocations).toBe(false);
    expect(clearedPlan.summary.isPlanExecutable).toBe(true);
  });

  it('Scenario 8: Mixed Retail Catalog processes multi-category demand accurately', () => {
    const sc = getScenario('mixed-retail-catalog')!;
    expect(sc).toBeDefined();

    const plan = OrderMaterialPlanner.calculatePlan(sc.orders, sc.selectedOrderIds, sc.observations, sc.options);
    expect(plan.summary.totalOrdersSelected).toBe(3);
    expect(plan.summary.fullyFulfilledOrders).toBe(3);
    expect(plan.summary.totalPiecesAllocated).toBe(8); // 2 towels + 2 shampoo + 2 polo + 1 sneaker + 1 blocks = 8 pieces
    expect(plan.summary.isPlanExecutable).toBe(true);
  });

  it('Scenario 9: Stale Observations triggers freshness warnings without invalidating stock', () => {
    const sc = getScenario('stale-observations')!;
    expect(sc).toBeDefined();

    const plan = OrderMaterialPlanner.calculatePlan(sc.orders, sc.selectedOrderIds, sc.observations, sc.options);
    expect(plan.summary.staleObservationsCount).toBe(1);
    expect(plan.warnings.some(w => w.code === 'STALE_OBSERVATION')).toBe(true);
    // Stock is allocated and executable
    expect(plan.summary.totalPiecesAllocated).toBe(2);
    expect(plan.summary.isPlanExecutable).toBe(true);
  });

  it('Scenario 10: Combined Edge Cases evaluates multi-dimensional operational stress', () => {
    const sc = getScenario('combined-edge-cases')!;
    expect(sc).toBeDefined();

    const plan = OrderMaterialPlanner.calculatePlan(sc.orders, sc.selectedOrderIds, sc.observations, sc.options);
    // Demonstrates:
    // 1. Shared MU 502900
    const sharedTask = plan.pickList.find(t => t.muId === '502900');
    expect(sharedTask).toBeDefined();
    expect(sharedTask?.fulfillingOrderIds.length).toBe(2);

    // 2. Shortage on dog beds (requested 4, available 1)
    expect(plan.summary.totalPiecesShortage).toBe(3);

    // 3. Stale warning on loose sunscreen
    expect(plan.summary.staleObservationsCount).toBeGreaterThan(0);

    // 4. Bay lockout on EH14
    expect(plan.summary.hasRestrictedLocations).toBe(true);
    expect(plan.summary.isPlanExecutable).toBe(false);
  });
});

describe('Simulation Engine Integration With Synthetic Dataset', () => {
  it('bridges synthetic dataset into SimulationInputSnapshot and runs deterministic simulation', () => {
    const dataset = generateSyntheticWarehouseData({ seed: 48213, orderCount: 25, muCount: 120 });
    const snapshot = buildSimulationSnapshotFromDataset(dataset, 'BASELINE');

    expect(snapshot.workload.orders.length).toBe(25);
    expect(snapshot.inventory.length).toBeGreaterThan(50);
    expect(snapshot.locations.length).toBeGreaterThan(20);

    const engine = new PureTypeScriptSimulationEngine();
    const result = engine.executeRun(snapshot);

    expect(result.summary_metrics.total_orders).toBe(25);
    expect(result.summary_metrics.fulfilled_orders).toBeGreaterThan(0);
    expect(result.summary_metrics.total_travel_distance_meters).toBeGreaterThan(0);
    expect(result.summary_metrics.average_order_cycle_time_seconds).toBeGreaterThan(0);

    // Verification of determinism: second execution emits identical metrics
    const result2 = engine.executeRun(snapshot);
    expect(result.summary_metrics).toEqual(result2.summary_metrics);
  });
});
