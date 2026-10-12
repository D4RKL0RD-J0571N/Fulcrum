import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  LayoutEngine,
  WarehouseLayoutConfig,
  LocationStructured,
  InMemoryInventoryLedgerRepository,
  StockMovementLedgerEntry,
  StockReservation,
  normalizeWmsOrder,
  normalizeErpInventory
} from './index';

describe('LayoutEngine — 3 Canonical Layouts & Invariants', () => {
  const layoutA: WarehouseLayoutConfig = {
    id: 'layout_a',
    version: 1,
    workspaceId: 'ws_default',
    name: 'Layout A (With Prefix)',
    prefixEnabled: true,
    sides: [{ code: 'E', label: 'E-commerce' }],
    rowType: 'alpha',
    rowStart: 'A',
    rowCount: 26,
    defaultBaysPerRow: 20,
    bayOverrides: { H: 14 },
    bayPadding: 2,
    rowPadding: 0,
    levels: [
      { code: 'A', label: 'Bottom', accessType: 'manual', heightMeters: 0.5 },
      { code: 'B', label: 'Mid 1', accessType: 'manual', heightMeters: 2.0 },
      { code: 'C', label: 'Mid 2', accessType: 'manual', heightMeters: 3.5 },
      { code: 'D', label: 'Top', accessType: 'forklift', heightMeters: 5.5 }
    ],
    separator: '',
    defaultPlatformsPerLocation: 2,
    defaultPlatformCapacityUnits: 10,
    bayWidthMeters: 1.2,
    levelHeightMeters: 1.5,
    aisleWidthMeters: 2.5
  };

  const layoutB: WarehouseLayoutConfig = {
    id: 'layout_b',
    version: 1,
    workspaceId: 'ws_default',
    name: 'Layout B (No Prefix, Dash Sep)',
    prefixEnabled: false,
    sides: [],
    rowType: 'alpha',
    rowStart: 'A',
    rowCount: 10,
    defaultBaysPerRow: 30,
    bayPadding: 2,
    rowPadding: 0,
    levels: [
      { code: 'L1', label: 'Ground', accessType: 'manual', heightMeters: 0.0 },
      { code: 'L2', label: 'Upper', accessType: 'manual', heightMeters: 2.2 }
    ],
    separator: '-',
    defaultPlatformsPerLocation: 2,
    defaultPlatformCapacityUnits: 10,
    bayWidthMeters: 1.2,
    levelHeightMeters: 1.5,
    aisleWidthMeters: 2.5
  };

  const layoutC: WarehouseLayoutConfig = {
    id: 'layout_c',
    version: 1,
    workspaceId: 'ws_default',
    name: 'Layout C (Numeric Rows, Dot Sep)',
    prefixEnabled: false,
    sides: [],
    rowType: 'numeric',
    rowStart: 1,
    rowCount: 12,
    defaultBaysPerRow: 15,
    bayPadding: 2,
    rowPadding: 2,
    levels: [
      { code: 'B', label: 'Bottom', accessType: 'manual', heightMeters: 0.2 },
      { code: 'M', label: 'Middle', accessType: 'manual', heightMeters: 1.8 },
      { code: 'T', label: 'Top', accessType: 'forklift', heightMeters: 3.6 }
    ],
    separator: '.',
    defaultPlatformsPerLocation: 2,
    defaultPlatformCapacityUnits: 10,
    bayWidthMeters: 1.2,
    levelHeightMeters: 1.5,
    aisleWidthMeters: 2.5
  };

  it('verifies round-trip parse(format(x)) === x on generated locations (Layout A)', () => {
    const locs = LayoutEngine.generateLocations(layoutA);
    expect(locs.length).toBe(2056);

    for (let i = 0; i < 100; i++) {
      const loc = locs[i];
      const parsed = LayoutEngine.parseCode(layoutA, loc.code);
      expect(parsed).toEqual(loc.structured);
    }
  });

  it('rejects codes outside the valid layout range', () => {
    expect(LayoutEngine.validateCode(layoutA, 'EZ25A')).toBe(false); // bay 25 > 20
    expect(LayoutEngine.validateCode(layoutA, 'E101A')).toBe(false); // invalid row
    expect(LayoutEngine.validateCode(layoutA, 'EA01Z')).toBe(false); // level Z doesn't exist
  });

  it('rejects ambiguous templates without separator and unpadded numeric rows', () => {
    const ambiguousConfig: WarehouseLayoutConfig = {
      ...layoutC,
      separator: '',
      rowPadding: 0
    };
    const res = LayoutEngine.validateTemplate(ambiguousConfig);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain('Ambiguous template');
  });

  // Property-based test with fast-check
  it('property test: parse(format(x)) round-trip holds for all arbitrary valid coordinate tuples (Layout A)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 65, max: 90 }), // Rows A-Z
        fc.integer({ min: 1, max: 20 }),  // Bays 1-20
        fc.constantFrom('A', 'B', 'C', 'D'), // Levels A-D
        (rowChar, bayNum, level) => {
          const row = String.fromCharCode(rowChar);
          const structured: LocationStructured = { side: 'E', row, column: bayNum, level };
          const formatted = LayoutEngine.formatCode(layoutA, structured);
          const parsed = LayoutEngine.parseCode(layoutA, formatted);
          expect(parsed).toEqual(structured);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property test: parse(format(x)) round-trip holds for arbitrary valid coordinates (Layout B without prefix)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 65, max: 74 }), // Rows A-J
        fc.integer({ min: 1, max: 30 }),  // Bays 1-30
        fc.constantFrom('L1', 'L2'),
        (rowChar, bayNum, level) => {
          const row = String.fromCharCode(rowChar);
          const structured: LocationStructured = { row, column: bayNum, level };
          const formatted = LayoutEngine.formatCode(layoutB, structured);
          const parsed = LayoutEngine.parseCode(layoutB, formatted);
          expect(parsed).toEqual(structured);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('InMemoryInventoryLedgerRepository — Ledger & Invariant Testing', () => {
  it('maintains append-only movements with idempotency', async () => {
    const repo = new InMemoryInventoryLedgerRepository();
    const entry: StockMovementLedgerEntry = {
      movementId: 'mov_1',
      workspaceId: 'ws_default',
      idempotencyKey: 'idemp_key_100',
      timestamp: 1000,
      movementType: 'RECEIPT',
      toLocationId: 'loc_EH14D',
      toMuId: 'MU-39102',
      sku: '1524289001',
      quantityUnits: 50
    };

    await repo.appendMovement(entry);
    await repo.appendMovement(entry); // duplicate attempt

    const movements = await repo.getMovements('ws_default');
    expect(movements.length).toBe(1);

    const balances = await repo.getCurrentStock('ws_default', '1524289001');
    expect(balances[0].availableUnits).toBe(50);
  });

  it('enforces that reservations never exceed available balance', async () => {
    const repo = new InMemoryInventoryLedgerRepository();
    await repo.appendMovement({
      movementId: 'mov_receipt',
      workspaceId: 'ws_default',
      idempotencyKey: 'idemp_rec_01',
      timestamp: 1000,
      movementType: 'RECEIPT',
      toLocationId: 'loc_EH14A',
      toMuId: 'MU-39102',
      sku: '1524289001',
      quantityUnits: 10
    });

    const res: StockReservation = {
      reservationId: 'res_01',
      workspaceId: 'ws_default',
      orderId: '000815296',
      lineId: 'l1',
      sku: '1524289001',
      quantityUnits: 8,
      muId: 'MU-39102',
      locationId: 'loc_EH14A',
      status: 'RESERVED',
      createdAt: 1005
    };

    await repo.createReservation(res);

    const balances = await repo.getCurrentStock('ws_default', '1524289001');
    expect(balances[0].onHandUnits).toBe(10);
    expect(balances[0].reservedUnits).toBe(8);
    expect(balances[0].availableUnits).toBe(2);

    // Over-reservation must throw
    const overRes: StockReservation = {
      ...res,
      reservationId: 'res_02',
      quantityUnits: 5 // only 2 available!
    };

    await expect(repo.createReservation(overRes)).rejects.toThrow('Insufficient available stock');
  });

  describe('External WMS and ERP Connectors', () => {
    it('normalizes external WMS orders correctly', () => {
      const normalized = normalizeWmsOrder({
        order_reference: '815296',
        order_date: '2026-10-12',
        priority: 'URGENT',
        lines: [{ line_number: 1, item_code: '1524289001', requested_quantity: 2 }]
      }, 100);

      expect(normalized.order_id).toBe('000815296');
      expect(normalized.arrival_time).toBe(100);
      expect(normalized.priority).toBe('HIGH');
      expect(normalized.items[0].sku).toBe('1524289001');
    });

    it('normalizes external ERP inventory balance correctly', () => {
      const normalized = normalizeErpInventory({
        container_id: '502900',
        storage_bin: 'EH14A',
        material_number: '1524289001',
        unrestricted_stock: 6
      });

      expect(normalized.mu_id).toBe('502900');
      expect(normalized.location_id).toBe('loc_EH14A');
      expect(normalized.sku).toBe('1524289001');
      expect(normalized.quantity_units).toBe(6);
    });
  });
});
