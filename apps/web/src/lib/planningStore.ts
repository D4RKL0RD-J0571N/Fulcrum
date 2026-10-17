import {
  Order,
  OrderRequirementLine,
  StockObservation,
  PlanningRun,
  OrderMaterialPlanner,
  resolveCurrentObservations,
  normalizeLocationKey,
  normalizeMuKey
} from '@fulcrum/domain';

export interface PlanningAppState {
  orders: Order[];
  observations: StockObservation[];
  selectedOrderIds: string[];
  currentPlan: PlanningRun | null;
  history: PlanningRun[];
  staleThresholdMinutes: number;
}

const NOW = Date.now();
const MINUTE = 60 * 1000;

export const INITIAL_ORDERS: Order[] = [
  {
    orderId: '000815296',
    priority: 'HIGH',
    createdAt: NOW - 35 * MINUTE,
    notes: 'Urgent checkout fulfillment - Priority batch',
    lines: [
      { lineId: 'l1', materialSku: '1524289001', materialName: 'Athletic Tee Slim — Black / S', requestedQuantity: 3 },
      { lineId: 'l2', materialSku: '1524289002', materialName: 'Athletic Tee Slim — Black / M', requestedQuantity: 2 }
    ]
  },
  {
    orderId: '000815297',
    priority: 'STANDARD',
    createdAt: NOW - 25 * MINUTE,
    notes: 'Standard batch dispatch',
    lines: [
      { lineId: 'l3', materialSku: '1524289002', materialName: 'Athletic Tee Slim — Black / M', requestedQuantity: 4 },
      { lineId: 'l4', materialSku: '2841920001', materialName: 'Cargo Trouser Utility — Navy / 30', requestedQuantity: 2 }
    ]
  },
  {
    orderId: '000815298',
    priority: 'STANDARD',
    createdAt: NOW - 15 * MINUTE,
    notes: 'Floor customer request',
    lines: [
      { lineId: 'l5', materialSku: '1524289004', materialName: 'Athletic Tee Slim — Black / XL', requestedQuantity: 6 }
    ]
  }
];

export const INITIAL_OBSERVATIONS: StockObservation[] = [
  {
    observationId: 'obs_101',
    muId: '502900',
    materialSku: '1524289001',
    observedQuantity: 6,
    location: 'EC07A',
    observedAt: NOW - 12 * MINUTE,
    notes: 'Ground platform box'
  },
  {
    observationId: 'obs_102',
    muId: '502900', // Same physical MU 502900 contains Size M as well!
    materialSku: '1524289002',
    observedQuantity: 5,
    location: 'EC07A',
    observedAt: NOW - 12 * MINUTE,
    notes: 'Ground platform box'
  },
  {
    observationId: 'obs_103',
    muId: '502901',
    materialSku: '1524289002',
    observedQuantity: 3,
    location: 'EH14A',
    observedAt: NOW - 22 * MINUTE,
    notes: 'Secondary bay box'
  },
  {
    observationId: 'obs_104',
    muId: '202005',
    materialSku: '2841920001',
    observedQuantity: 5,
    location: 'EH14B',
    observedAt: NOW - 40 * MINUTE,
    notes: 'Rack B tier container'
  },
  {
    observationId: 'obs_105',
    muId: undefined, // Loose uncontainerized stock
    materialSku: '1524289004',
    observedQuantity: 4, // Intentionally 4 (less than 6 requested for order 000815298 to demonstrate clear shortage detection)
    location: undefined, // Demonstrates graceful handling of unlocated observation
    observedAt: NOW - 10 * MINUTE,
    notes: 'Visualized on order screen without container or explicit bin'
  }
];

export function createInitialPlanningState(): PlanningAppState {
  const selectedOrderIds = ['000815296', '000815297'];
  const initialPlan = OrderMaterialPlanner.calculatePlan(
    INITIAL_ORDERS,
    selectedOrderIds,
    INITIAL_OBSERVATIONS,
    { staleThresholdMinutes: 60 }
  );

  return {
    orders: INITIAL_ORDERS,
    observations: INITIAL_OBSERVATIONS,
    selectedOrderIds,
    currentPlan: initialPlan,
    history: [initialPlan],
    staleThresholdMinutes: 60
  };
}
