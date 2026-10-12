import { describe, it, expect } from 'vitest';
import { LayoutEngine, WarehouseLayoutConfig, LocationStructured } from './index';

describe('LayoutEngine', () => {
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

  it('correctly formats and parses codes for Layout A (EH14D)', () => {
    const loc: LocationStructured = { side: 'E', row: 'H', column: 14, level: 'D' };
    const code = LayoutEngine.formatCode(layoutA, loc);
    expect(code).toBe('EH14D');

    const parsed = LayoutEngine.parseCode(layoutA, code);
    expect(parsed).toEqual(loc);
  });

  it('correctly formats and parses codes for Layout B (H-14-L1)', () => {
    const loc: LocationStructured = { row: 'H', column: 14, level: 'L1' };
    const code = LayoutEngine.formatCode(layoutB, loc);
    expect(code).toBe('H-14-L1');

    const parsed = LayoutEngine.parseCode(layoutB, code);
    expect(parsed).toEqual(loc);
  });

  it('correctly formats and parses codes for Layout C (08.14.B)', () => {
    const loc: LocationStructured = { row: '8', column: 14, level: 'B' };
    const code = LayoutEngine.formatCode(layoutC, loc);
    expect(code).toBe('08.14.B');

    const parsed = LayoutEngine.parseCode(layoutC, code);
    expect(parsed).toEqual({ row: '08', column: 14, level: 'B', side: undefined });
  });

  it('generates correct location counts accounting for bay overrides', () => {
    const locsA = LayoutEngine.generateLocations(layoutA);
    // 25 rows with 20 bays = 500 bays. Row H with 14 bays. Total bays = 514.
    // 4 levels per bay = 514 * 4 = 2056 locations.
    expect(locsA.length).toBe(2056);
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

  it('computes positive physical distance', () => {
    const loc1: LocationStructured = { side: 'E', row: 'A', column: 1, level: 'A' };
    const loc2: LocationStructured = { side: 'E', row: 'B', column: 5, level: 'D' };
    const dist = LayoutEngine.computeDistance(layoutA, loc1, loc2);
    expect(dist).toBeGreaterThan(0);
  });
});
