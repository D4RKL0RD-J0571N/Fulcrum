import {
  WarehouseLayoutConfig,
  LayoutEngine,
  WarehouseLocationEntity,
  StockMovementLedgerEntry,
  StockReservation,
  CurrentStockBalance,
  InMemoryInventoryLedgerRepository
} from '@fulcrum/domain';
import { SimulationInputSnapshot } from '@fulcrum/contracts';

export interface UserAllocatedItem {
  sku: string;
  skuName: string;
  parentSku: string;
  quantityUnits: number;
  lotNumber: string;
}

export interface UserManipulationUnit {
  muId: string; // 6-digit numeric (e.g. 502900)
  locationId: string; // e.g. loc_EH14A
  locationCode: string; // e.g. EH14A
  platformId: string; // plat_1 or plat_2
  platformName: string;
  items: UserAllocatedItem[];
}

export interface UserCreatedOrder {
  orderId: string; // 9-digit (e.g. 000815296)
  arrivalTimeSeconds: number;
  deadlineSeconds: number;
  priority: 'HIGH' | 'STANDARD';
  items: Array<{ lineId: string; sku: string; quantityUnits: number; skuName?: string }>;
}

export interface FacilityState {
  layout: WarehouseLayoutConfig;
  locations: WarehouseLocationEntity[];
  manipulationUnits: UserManipulationUnit[];
  orders: UserCreatedOrder[];
  ledger: InMemoryInventoryLedgerRepository;
}

export const DEFAULT_FACILITY_LAYOUT: WarehouseLayoutConfig = {
  id: 'layout_wh01',
  version: 1,
  workspaceId: 'ws_default',
  name: 'Global Fulfillment WH-01',
  prefixEnabled: true,
  sides: [{ code: 'E', label: 'E-commerce' }],
  rowType: 'alpha',
  rowStart: 'A',
  rowCount: 26, // Rows A-Z
  defaultBaysPerRow: 20,
  bayOverrides: { H: 14, Q: 18, W: 16 },
  bayPadding: 2,
  rowPadding: 0,
  levels: [
    { code: 'A', label: 'Bottom (Manual Pull)', accessType: 'manual', heightMeters: 0.5 },
    { code: 'B', label: 'Mid (Manual)', accessType: 'manual', heightMeters: 2.0 },
    { code: 'C', label: 'Top (Manual)', accessType: 'manual', heightMeters: 3.5 },
    { code: 'D', label: 'Upper Tier (Forklift Only)', accessType: 'forklift', heightMeters: 5.5 }
  ],
  separator: '',
  defaultPlatformsPerLocation: 2,
  defaultPlatformCapacityUnits: 9, // up to 9 MUs per platform -> 18 per level
  bayWidthMeters: 1.2,
  levelHeightMeters: 1.5,
  aisleWidthMeters: 2.8,
  blockedBays: ['J-8', 'R-12', 'C-15']
};

export function createInitialFacilityState(): FacilityState {
  const layout = { ...DEFAULT_FACILITY_LAYOUT };
  const locations = LayoutEngine.generateLocations(layout);
  const ledger = new InMemoryInventoryLedgerRepository();

  // Curated initial realistic MUs with packs of 5-6 units per sequential size
  const initialMus: UserManipulationUnit[] = [
    {
      muId: '502900',
      locationId: 'loc_EH14A',
      locationCode: 'EH14A',
      platformId: 'plat_1',
      platformName: 'Platform 1 (Ground Manual Pull)',
      items: [
        { sku: '1524289001', skuName: 'Athletic Tee Slim — Black / S', parentSku: '1524289', quantityUnits: 6, lotNumber: 'L-A92' },
        { sku: '1524289002', skuName: 'Athletic Tee Slim — Black / M', parentSku: '1524289', quantityUnits: 5, lotNumber: 'L-A92' },
        { sku: '1524289003', skuName: 'Athletic Tee Slim — Black / L', parentSku: '1524289', quantityUnits: 5, lotNumber: 'L-A92' }
      ]
    },
    {
      muId: '502901',
      locationId: 'loc_EH14A',
      locationCode: 'EH14A',
      platformId: 'plat_1',
      platformName: 'Platform 1 (Ground Manual Pull)',
      items: [
        { sku: '1524289004', skuName: 'Athletic Tee Slim — Black / XL', parentSku: '1524289', quantityUnits: 6, lotNumber: 'L-A92' },
        { sku: '2841920001', skuName: 'Cargo Trouser Utility — Navy / 30', parentSku: '2841920', quantityUnits: 5, lotNumber: 'L-C04' }
      ]
    },
    {
      muId: '101003',
      locationId: 'loc_EH14D',
      locationCode: 'EH14D',
      platformId: 'plat_1',
      platformName: 'Platform 1 (Forklift Upper Tier)',
      items: [
        { sku: '1524289004', skuName: 'Athletic Tee Slim — Black / XL', parentSku: '1524289', quantityUnits: 6, lotNumber: 'L-A93' },
        { sku: '1524289005', skuName: 'Athletic Tee Slim — Black / XXL', parentSku: '1524289', quantityUnits: 6, lotNumber: 'L-A93' }
      ]
    },
    {
      muId: '202005',
      locationId: 'loc_EC07A',
      locationCode: 'EC07A',
      platformId: 'plat_2',
      platformName: 'Platform 2 (Manual Ground)',
      items: [
        { sku: '1524289001', skuName: 'Athletic Tee Slim — Black / S', parentSku: '1524289', quantityUnits: 12, lotNumber: 'L-B11' }
      ]
    }
  ];

  // Seed inventory ledger
  let timestamp = Date.now();
  for (const mu of initialMus) {
    for (const it of mu.items) {
      ledger.appendMovement({
        movementId: `mov_${mu.muId}_${it.sku}`,
        workspaceId: layout.workspaceId,
        idempotencyKey: `init_${mu.muId}_${it.sku}`,
        timestamp: timestamp++,
        movementType: 'RECEIPT',
        toLocationId: mu.locationId,
        toMuId: mu.muId,
        sku: it.sku,
        quantityUnits: it.quantityUnits,
        lotNumber: it.lotNumber,
        reason: 'Initial storage allocation'
      });
    }
  }

  const initialOrders: UserCreatedOrder[] = [
    {
      orderId: '000815296',
      arrivalTimeSeconds: 0,
      deadlineSeconds: 3600,
      priority: 'HIGH',
      items: [{ lineId: 'l1', sku: '1524289001', quantityUnits: 1, skuName: 'Athletic Tee Slim - S' }]
    },
    {
      orderId: '000815297',
      arrivalTimeSeconds: 60,
      deadlineSeconds: 3600,
      priority: 'HIGH',
      items: [{ lineId: 'l2', sku: '1524289002', quantityUnits: 1, skuName: 'Athletic Tee Slim - M' }]
    },
    {
      orderId: '000815298',
      arrivalTimeSeconds: 120,
      deadlineSeconds: 3600,
      priority: 'STANDARD',
      items: [{ lineId: 'l3', sku: '1524289004', quantityUnits: 1, skuName: 'Athletic Tee Slim - XL' }]
    },
    {
      orderId: '000815299',
      arrivalTimeSeconds: 180,
      deadlineSeconds: 3600,
      priority: 'HIGH',
      items: [{ lineId: 'l4', sku: '1524289003', quantityUnits: 2, skuName: 'Athletic Tee Slim - L' }]
    }
  ];

  return {
    layout,
    locations,
    manipulationUnits: initialMus,
    orders: initialOrders,
    ledger
  };
}

/**
 * Builds a valid SimulationInputSnapshot dynamically from user-configured facility state.
 */
export function buildSimulationSnapshot(
  facility: FacilityState,
  strategy: 'BASELINE' | 'BATCH_WAVE_ROUTING' = 'BASELINE',
  seed = 48213
): SimulationInputSnapshot {
  const locMap = new Map(facility.locations.map(l => [l.id, l]));

  const simLocations = facility.locations.map(l => ({
    id: l.id,
    x: l.coordinates.x,
    y: l.coordinates.y,
    z: l.coordinates.z,
    access_type: l.accessType,
    capacity: l.maxPlatforms,
    is_blocked: l.isBlocked
  }));

  const simInventory: Array<{
    mu_id: string;
    location_id: string;
    sku: string;
    quantity_units: number;
    platform_id?: string;
  }> = [];

  for (const mu of facility.manipulationUnits) {
    for (const item of mu.items) {
      simInventory.push({
        mu_id: mu.muId,
        location_id: mu.locationId,
        sku: item.sku,
        quantity_units: item.quantityUnits,
        platform_id: mu.platformId
      });
    }
  }

  const simOrders = facility.orders.map(o => ({
    order_id: o.orderId,
    arrival_time: o.arrivalTimeSeconds,
    deadline: o.deadlineSeconds,
    priority: o.priority,
    items: o.items.map(it => ({
      line_id: it.lineId,
      sku: it.sku,
      quantity_units: it.quantityUnits
    }))
  }));

  return {
    contract_version: '1.0.0',
    snapshot_id: `snap_${Date.now()}`,
    snapshot_hash: `hash_${facility.layout.version}_${seed}`,
    workspace_id: facility.layout.workspaceId,
    seed,
    config: {
      start_time_seconds: 0,
      duration_seconds: 28800,
      strategy
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
    locations: simLocations,
    inventory: simInventory,
    workload: {
      orders: simOrders,
      replenishment_triggers: []
    },
    resources: {
      manual_pickers: [{ id: 'pkr_1', name: 'Picker 1', speed_mps: 1.2 }],
      forklifts: [{ id: 'flt_1', name: 'Forklift 1', speed_mps: 2.0 }]
    }
  };
}
