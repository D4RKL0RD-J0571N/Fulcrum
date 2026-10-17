import { describe, it, expect } from 'vitest';
import {
  Order,
  StockObservation,
  OrderMaterialPlanner,
  resolveCurrentObservations,
  normalizeLocationKey,
  normalizeMuKey
} from './planning';

describe('OrderMaterialPlanner & MU-Aware Physical Collection Planning', () => {
  const baseTime = 1700000000000;

  // Helper to create test orders
  const createOrder = (
    id: string,
    lines: Array<{ sku: string; qty: number; name?: string }>,
    priority?: 'HIGH' | 'STANDARD' | 'LOW'
  ): Order => ({
    orderId: id,
    createdAt: baseTime,
    priority: priority || 'STANDARD',
    lines: lines.map((l, i) => ({
      lineId: `line_${id}_${i + 1}`,
      materialSku: l.sku,
      requestedQuantity: l.qty,
      materialName: l.name
    }))
  });

  describe('Observation Resolution & Multi-SKU Container Semantics', () => {
    it('normalizes location and MU keys properly', () => {
      expect(normalizeLocationKey(undefined)).toBe('');
      expect(normalizeLocationKey(null)).toBe('');
      expect(normalizeLocationKey('  eh14a ')).toBe('EH14A');

      expect(normalizeMuKey(undefined)).toBe('');
      expect(normalizeMuKey(null)).toBe('');
      expect(normalizeMuKey(' 502900 ')).toBe('502900');
    });

    it('supersedes older observation for the same MU and SKU without discarding unrelated SKUs in that MU', () => {
      const observations: StockObservation[] = [
        // MU 502900 holds SKU_A and SKU_B
        {
          observationId: 'obs_1',
          muId: '502900',
          materialSku: 'SKU_A',
          observedQuantity: 6,
          location: 'EH14A',
          observedAt: baseTime - 60000
        },
        {
          observationId: 'obs_2',
          muId: '502900',
          materialSku: 'SKU_B',
          observedQuantity: 5,
          location: 'EH14A',
          observedAt: baseTime - 60000
        },
        // Refreshed observation for SKU_A in MU 502900: count updated to 4
        {
          observationId: 'obs_3',
          muId: '502900',
          materialSku: 'SKU_A',
          observedQuantity: 4,
          location: 'EH14A',
          observedAt: baseTime
        }
      ];

      const current = resolveCurrentObservations(observations);
      expect(current).toHaveLength(2); // SKU_A and SKU_B both exist for MU 502900

      const currentA = current.find(o => o.materialSku === 'SKU_A');
      const currentB = current.find(o => o.materialSku === 'SKU_B');

      expect(currentA?.observationId).toBe('obs_3');
      expect(currentA?.observedQuantity).toBe(4); // Refreshed

      expect(currentB?.observationId).toBe('obs_2');
      expect(currentB?.observedQuantity).toBe(5); // Preserved! Unrelated SKU not deleted
    });

    it('resolves conflicting observations with the exact same timestamp deterministically by observationId', () => {
      const observations: StockObservation[] = [
        {
          observationId: 'obs_tie_1',
          muId: '600100',
          materialSku: 'SKU_X',
          observedQuantity: 8,
          location: 'BAY_01',
          observedAt: baseTime
        },
        {
          observationId: 'obs_tie_2',
          muId: '600100',
          materialSku: 'SKU_X',
          observedQuantity: 10,
          location: 'BAY_01',
          observedAt: baseTime
        }
      ];

      const current = resolveCurrentObservations(observations);
      expect(current).toHaveLength(1);
      // Higher observationId wins tie-breaker
      expect(current[0].observationId).toBe('obs_tie_2');
      expect(current[0].observedQuantity).toBe(10);
    });

    it('distinguishes containerized observations from loose/uncontainerized stock', () => {
      const observations: StockObservation[] = [
        {
          observationId: 'obs_box',
          muId: '502900',
          materialSku: 'SKU_Z',
          observedQuantity: 10,
          location: 'EC07A',
          observedAt: baseTime
        },
        {
          observationId: 'obs_loose',
          muId: undefined, // Loose piece
          materialSku: 'SKU_Z',
          observedQuantity: 3,
          location: 'EC07A',
          observedAt: baseTime
        }
      ];

      const current = resolveCurrentObservations(observations);
      expect(current).toHaveLength(2);
      expect(current.find(o => o.muId === '502900')?.observedQuantity).toBe(10);
      expect(current.find(o => !o.muId)?.observedQuantity).toBe(3);
    });
  });

  describe('Manipulation Unit (MU) Collection Planning', () => {
    it('1. aggregates multiple SKUs and multiple orders served by ONE physical MU into a single collection task', () => {
      // MU 502900 at EH14A contains Size S (qty 6) and Size M (qty 5)
      const observations: StockObservation[] = [
        {
          observationId: 'obs_s',
          muId: '502900',
          materialSku: 'SHIRT_S',
          observedQuantity: 6,
          location: 'EH14A',
          observedAt: baseTime
        },
        {
          observationId: 'obs_m',
          muId: '502900',
          materialSku: 'SHIRT_M',
          observedQuantity: 5,
          location: 'EH14A',
          observedAt: baseTime
        }
      ];

      // Order 1 needs 2 units of Size S
      const order1 = createOrder('ORD_001', [{ sku: 'SHIRT_S', qty: 2 }]);
      // Order 2 needs 3 units of Size M
      const order2 = createOrder('ORD_002', [{ sku: 'SHIRT_M', qty: 3 }]);

      const plan = OrderMaterialPlanner.calculatePlan(
        [order1, order2],
        ['ORD_001', 'ORD_002'],
        observations,
        { referenceTime: baseTime }
      );

      // CRITICAL: Distinct physical MU count must equal 1!
      expect(plan.summary.totalManipulationUnitsToCollect).toBe(1);
      expect(plan.summary.totalPiecesAllocated).toBe(5);
      expect(plan.summary.totalPiecesShortage).toBe(0);

      // The collection list must have exactly 1 task for MU 502900
      expect(plan.pickList).toHaveLength(1);
      const muTask = plan.pickList[0];
      expect(muTask.muId).toBe('502900');
      expect(muTask.location).toBe('EH14A');
      expect(muTask.isLoose).toBe(false);
      expect(muTask.totalPieces).toBe(5);
      expect(muTask.fulfillingOrderIds).toEqual(['ORD_001', 'ORD_002']);

      // Check extracted item lines within this MU
      expect(muTask.items).toHaveLength(2);
      const itemS = muTask.items.find(i => i.materialSku === 'SHIRT_S');
      const itemM = muTask.items.find(i => i.materialSku === 'SHIRT_M');

      expect(itemS?.quantity).toBe(2);
      expect(itemS?.allocations).toEqual([{ orderId: 'ORD_001', lineId: 'line_ORD_001_1', quantity: 2 }]);

      expect(itemM?.quantity).toBe(3);
      expect(itemM?.allocations).toEqual([{ orderId: 'ORD_002', lineId: 'line_ORD_002_1', quantity: 3 }]);
    });

    it('2. plans multiple distinct MUs when a single order requires items in different containers', () => {
      const observations: StockObservation[] = [
        {
          observationId: 'obs_1',
          muId: 'MU_ALPHA',
          materialSku: 'SKU_1',
          observedQuantity: 5,
          location: 'RACK_1',
          observedAt: baseTime
        },
        {
          observationId: 'obs_2',
          muId: 'MU_BETA',
          materialSku: 'SKU_2',
          observedQuantity: 5,
          location: 'RACK_2',
          observedAt: baseTime
        }
      ];

      // Single order requires both items
      const order = createOrder('ORD_MULTI_MU', [
        { sku: 'SKU_1', qty: 2 },
        { sku: 'SKU_2', qty: 4 }
      ]);

      const plan = OrderMaterialPlanner.calculatePlan([order], ['ORD_MULTI_MU'], observations, { referenceTime: baseTime });

      // Worker must collect 2 distinct physical MUs
      expect(plan.summary.totalManipulationUnitsToCollect).toBe(2);
      expect(plan.summary.totalPiecesAllocated).toBe(6);

      expect(plan.pickList).toHaveLength(2);
      const muAlpha = plan.pickList.find(t => t.muId === 'MU_ALPHA');
      const muBeta = plan.pickList.find(t => t.muId === 'MU_BETA');

      expect(muAlpha?.totalPieces).toBe(2);
      expect(muBeta?.totalPieces).toBe(4);
      expect(muAlpha?.fulfillingOrderIds).toEqual(['ORD_MULTI_MU']);
      expect(muBeta?.fulfillingOrderIds).toEqual(['ORD_MULTI_MU']);
    });

    it('3. reuses an already selected MU to minimize distinct physical MUs collected', () => {
      // Setup:
      // MU_REUSE has SKU_A (qty 1) and SKU_B (qty 5)
      // MU_OTHER has SKU_B (qty 5)
      // Order 1 needs SKU_A (which forces selecting MU_REUSE)
      // Order 2 needs SKU_B
      const observations: StockObservation[] = [
        {
          observationId: 'obs_other',
          muId: 'MU_OTHER',
          materialSku: 'SKU_B',
          observedQuantity: 5,
          location: 'LOC_A',
          observedAt: baseTime
        },
        {
          observationId: 'obs_reuse_a',
          muId: 'MU_REUSE',
          materialSku: 'SKU_A',
          observedQuantity: 1,
          location: 'LOC_B',
          observedAt: baseTime
        },
        {
          observationId: 'obs_reuse_b',
          muId: 'MU_REUSE',
          materialSku: 'SKU_B',
          observedQuantity: 5,
          location: 'LOC_B',
          observedAt: baseTime
        }
      ];

      const order1 = createOrder('ORD_1', [{ sku: 'SKU_A', qty: 1 }]);
      const order2 = createOrder('ORD_2', [{ sku: 'SKU_B', qty: 3 }]);

      const plan = OrderMaterialPlanner.calculatePlan([order1, order2], ['ORD_1', 'ORD_2'], observations, { referenceTime: baseTime });

      // Because MU_REUSE was already selected for Order 1, the planner should draw SKU_B from MU_REUSE
      // instead of pulling an unnecessary second container MU_OTHER!
      expect(plan.summary.totalManipulationUnitsToCollect).toBe(1);
      expect(plan.pickList).toHaveLength(1);
      expect(plan.pickList[0].muId).toBe('MU_REUSE');
      expect(plan.pickList[0].totalPieces).toBe(4); // 1 of A + 3 of B
    });

    it('4. handles loose uncontainerized stock without counting it as a physical MU', () => {
      const observations: StockObservation[] = [
        // One physical containerized MU
        {
          observationId: 'obs_box',
          muId: 'BOX_101',
          materialSku: 'SKU_BOX',
          observedQuantity: 5,
          location: 'LOC_1',
          observedAt: baseTime
        },
        // Loose uncontainerized shelf stock
        {
          observationId: 'obs_loose',
          muId: undefined, // Loose!
          materialSku: 'SKU_LOOSE',
          observedQuantity: 10,
          location: 'LOC_2',
          observedAt: baseTime
        }
      ];

      const order = createOrder('ORD_MIXED', [
        { sku: 'SKU_BOX', qty: 2 },
        { sku: 'SKU_LOOSE', qty: 4 }
      ]);

      const plan = OrderMaterialPlanner.calculatePlan([order], ['ORD_MIXED'], observations, { referenceTime: baseTime });

      // Physical MU count must be exactly 1 (BOX_101). Loose stock does NOT count as a physical MU!
      expect(plan.summary.totalManipulationUnitsToCollect).toBe(1);
      expect(plan.summary.totalLooseStockTasks).toBe(1);
      expect(plan.summary.totalPiecesAllocated).toBe(6);

      const looseTask = plan.pickList.find(t => t.isLoose);
      const boxTask = plan.pickList.find(t => !t.isLoose);

      expect(boxTask?.muId).toBe('BOX_101');
      expect(boxTask?.totalPieces).toBe(2);

      expect(looseTask?.isLoose).toBe(true);
      expect(looseTask?.location).toBe('LOC_2');
      expect(looseTask?.totalPieces).toBe(4);
    });

    it('5. enforces quantity constraints per SKU and MU without over-allocating', () => {
      const observations: StockObservation[] = [
        {
          observationId: 'obs_1',
          muId: 'BOX_EXHAUST',
          materialSku: 'SKU_CAPPED',
          observedQuantity: 4,
          location: 'BIN_A',
          observedAt: baseTime
        }
      ];

      const order1 = createOrder('ORD_A', [{ sku: 'SKU_CAPPED', qty: 3 }]);
      const order2 = createOrder('ORD_B', [{ sku: 'SKU_CAPPED', qty: 3 }]);

      const plan = OrderMaterialPlanner.calculatePlan([order1, order2], ['ORD_A', 'ORD_B'], observations, { referenceTime: baseTime });

      // Total available is 4. Allocations must sum to exactly 4.
      expect(plan.summary.totalPiecesAllocated).toBe(4);
      expect(plan.summary.totalPiecesShortage).toBe(2);

      expect(plan.shortages).toHaveLength(1);
      expect(plan.shortages[0].orderId).toBe('ORD_B');
      expect(plan.shortages[0].shortageQuantity).toBe(2);
    });

    it('6. preserves historical planning snapshots and never mutates inputs', () => {
      const order = createOrder('ORD_IMM', [{ sku: 'SKU_IMM', qty: 5 }]);
      const initialObs: StockObservation[] = [
        {
          observationId: 'obs_init',
          muId: 'BOX_IMM',
          materialSku: 'SKU_IMM',
          observedQuantity: 5,
          location: 'LOC_IMM',
          observedAt: baseTime
        }
      ];

      const plan1 = OrderMaterialPlanner.calculatePlan([order], ['ORD_IMM'], initialObs, { referenceTime: baseTime });
      expect(plan1.summary.totalPiecesAllocated).toBe(5);

      // External stock is refreshed with fewer units
      const updatedObs: StockObservation[] = [
        ...initialObs,
        {
          observationId: 'obs_refreshed',
          muId: 'BOX_IMM',
          materialSku: 'SKU_IMM',
          observedQuantity: 1, // Dropped to 1
          location: 'LOC_IMM',
          observedAt: baseTime + 10000
        }
      ];

      // Plan 1 remains completely unchanged
      expect(plan1.summary.totalPiecesAllocated).toBe(5);
      expect(plan1.inputSnapshot.activeObservations[0].observedQuantity).toBe(5);

      // Plan 2 reflects new count
      const plan2 = OrderMaterialPlanner.calculatePlan([order], ['ORD_IMM'], updatedObs, { referenceTime: baseTime + 10000 });
      expect(plan2.summary.totalPiecesAllocated).toBe(1);
      expect(plan2.summary.totalPiecesShortage).toBe(4);
    });

    it('7. detects conflicting known locations on the same MU and flags CONFLICTING_MU_LOCATION warning', () => {
      // Setup: MU 502900 has SKU_A at EA01A and SKU_B at EB02B
      const observations: StockObservation[] = [
        {
          observationId: 'obs_c1',
          muId: '502900',
          materialSku: 'SKU_A',
          observedQuantity: 5,
          location: 'EA01A',
          observedAt: baseTime
        },
        {
          observationId: 'obs_c2',
          muId: '502900',
          materialSku: 'SKU_B',
          observedQuantity: 3,
          location: 'EB02B',
          observedAt: baseTime
        }
      ];

      const order = createOrder('ORD_CONFLICT', [
        { sku: 'SKU_A', qty: 2 },
        { sku: 'SKU_B', qty: 1 }
      ]);

      const plan = OrderMaterialPlanner.calculatePlan([order], ['ORD_CONFLICT'], observations, { referenceTime: baseTime });

      // Invariants:
      // 1. Exactly ONE physical MU counted
      expect(plan.summary.totalManipulationUnitsToCollect).toBe(1);
      expect(plan.pickList).toHaveLength(1);

      // 2. Conflict detected on task
      const task = plan.pickList[0];
      expect(task.muId).toBe('502900');
      expect(task.hasLocationConflict).toBe(true);
      expect(task.conflictingLocations).toEqual(['EA01A', 'EB02B']);
      expect(task.location).toContain('EA01A vs EB02B');

      // 3. Warning emitted with details
      const conflictWarning = plan.warnings.find(w => w.code === 'CONFLICTING_MU_LOCATION');
      expect(conflictWarning).toBeDefined();
      expect(conflictWarning?.muId).toBe('502900');
      expect(conflictWarning?.conflictingLocations).toEqual(['EA01A', 'EB02B']);

      // 4. Plan is marked as having unresolved conflicts / not executable
      expect(plan.summary.hasUnresolvedConflicts).toBe(true);
      expect(plan.summary.conflictingMuCount).toBe(1);
      expect(plan.summary.isPlanExecutable).toBe(false);
    });

    it('8. handles known plus unspecified location without raising a false conflict', () => {
      // Setup: MU 502900 has SKU_A at EA01A, and SKU_B with unspecified location
      const observations: StockObservation[] = [
        {
          observationId: 'obs_k1',
          muId: '502900',
          materialSku: 'SKU_A',
          observedQuantity: 5,
          location: 'EA01A',
          observedAt: baseTime
        },
        {
          observationId: 'obs_k2',
          muId: '502900',
          materialSku: 'SKU_B',
          observedQuantity: 3,
          location: undefined, // Unspecified
          observedAt: baseTime
        }
      ];

      const order = createOrder('ORD_NO_CONFLICT', [
        { sku: 'SKU_A', qty: 2 },
        { sku: 'SKU_B', qty: 2 }
      ]);

      const plan = OrderMaterialPlanner.calculatePlan([order], ['ORD_NO_CONFLICT'], observations, { referenceTime: baseTime });

      expect(plan.summary.totalManipulationUnitsToCollect).toBe(1);
      expect(plan.pickList).toHaveLength(1);

      const task = plan.pickList[0];
      expect(task.muId).toBe('502900');
      // Must attribute the known location without a false conflict
      expect(task.hasLocationConflict).toBe(false);
      expect(task.location).toBe('EA01A');
      expect(task.isUnspecifiedLocation).toBe(false);

      // No conflict warning
      expect(plan.warnings.some(w => w.code === 'CONFLICTING_MU_LOCATION')).toBe(false);
      expect(plan.summary.hasUnresolvedConflicts).toBe(false);
      expect(plan.summary.isPlanExecutable).toBe(true);
    });

    it('9. counts one physical MU exactly once despite conflicting location observations', () => {
      const observations: StockObservation[] = [
        { observationId: 'obs_1', muId: 'CONTAINER_99', materialSku: 'ITEM_1', observedQuantity: 10, location: 'BAY_A', observedAt: baseTime },
        { observationId: 'obs_2', muId: 'CONTAINER_99', materialSku: 'ITEM_2', observedQuantity: 10, location: 'BAY_B', observedAt: baseTime },
        { observationId: 'obs_3', muId: 'CONTAINER_99', materialSku: 'ITEM_3', observedQuantity: 10, location: 'BAY_C', observedAt: baseTime }
      ];

      const order = createOrder('ORD_TRIPLE', [
        { sku: 'ITEM_1', qty: 1 },
        { sku: 'ITEM_2', qty: 2 },
        { sku: 'ITEM_3', qty: 3 }
      ]);

      const plan = OrderMaterialPlanner.calculatePlan([order], ['ORD_TRIPLE'], observations, { referenceTime: baseTime });

      // Physical MU count MUST be exactly 1
      expect(plan.summary.totalManipulationUnitsToCollect).toBe(1);
      expect(plan.pickList).toHaveLength(1);
      expect(plan.pickList[0].totalPieces).toBe(6);
      expect(plan.pickList[0].hasLocationConflict).toBe(true);
      expect(plan.pickList[0].conflictingLocations).toEqual(['BAY_A', 'BAY_B', 'BAY_C']);
      expect(plan.summary.conflictingMuCount).toBe(1);
    });
  });
});
