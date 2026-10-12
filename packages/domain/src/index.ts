import { z } from 'zod';
import { LocationAccessType, LocationAccessTypeSchema } from '@fulcrum/contracts';

/* ============================================================
   1. REPOSITORY INTERFACES
   ============================================================ */

export interface StockMovementLedgerEntry {
  movementId: string;
  workspaceId: string;
  idempotencyKey: string;
  timestamp: number;
  movementType: 'RECEIPT' | 'TRANSFER' | 'PICK' | 'REPLENISHMENT' | 'ADJUSTMENT';
  fromLocationId?: string;
  toLocationId?: string;
  fromMuId?: string;
  toMuId?: string;
  sku: string;
  quantityUnits: number;
  lotNumber?: string;
  operatorId?: string;
  reason?: string;
}

export interface StockReservation {
  reservationId: string;
  workspaceId: string;
  orderId: string;
  lineId: string;
  sku: string;
  quantityUnits: number;
  muId: string;
  locationId: string;
  status: 'RESERVED' | 'COMMITTED' | 'RELEASED';
  createdAt: number;
}

export interface CurrentStockBalance {
  sku: string;
  muId: string;
  locationId: string;
  onHandUnits: number;
  reservedUnits: number;
  availableUnits: number;
}

export interface InventoryLedgerRepository {
  appendMovement(entry: StockMovementLedgerEntry): Promise<StockMovementLedgerEntry>;
  getMovements(workspaceId: string): Promise<StockMovementLedgerEntry[]>;
  createReservation(reservation: StockReservation): Promise<StockReservation>;
  releaseReservation(reservationId: string): Promise<void>;
  getCurrentStock(workspaceId: string, sku?: string): Promise<CurrentStockBalance[]>;
}

export interface WarehouseLayoutRepository {
  getActiveLayout(workspaceId: string): Promise<WarehouseLayoutConfig | null>;
  saveLayoutVersion(layout: WarehouseLayoutConfig): Promise<WarehouseLayoutConfig>;
  getLayoutHistory(workspaceId: string): Promise<WarehouseLayoutConfig[]>;
}

/* ============================================================
   2. DOMAIN LAYOUT & LOCATION SPECIFICATION
   ============================================================ */

export interface LevelDefinition {
  code: string;
  label: string;
  accessType: LocationAccessType;
  heightMeters: number;
}

export interface SideDefinition {
  code: string;
  label: string;
}

export interface WarehouseLayoutConfig {
  id: string;
  version: number;
  workspaceId: string;
  name: string;
  prefixEnabled: boolean;
  sides: SideDefinition[];
  rowType: 'alpha' | 'numeric';
  rowStart: string | number;
  rowCount: number;
  defaultBaysPerRow: number;
  bayOverrides?: Record<string, number>;
  bayPadding: number;
  rowPadding: number;
  levels: LevelDefinition[];
  separator: '' | '-' | '.';
  defaultPlatformsPerLocation: number;
  defaultPlatformCapacityUnits: number;
  bayWidthMeters: number;
  levelHeightMeters: number;
  aisleWidthMeters: number;
  blockedBays?: string[]; // e.g. ["H-12", "A-01"]
}

export interface LocationStructured {
  side?: string;
  row: string;
  column: number;
  level: string;
}

export interface PhysicalCoordinates {
  x: number;
  y: number;
  z: number;
}

export interface WarehouseLocationEntity {
  id: string;
  layoutVersion: number;
  workspaceId: string;
  code: string;
  structured: LocationStructured;
  coordinates: PhysicalCoordinates;
  accessType: LocationAccessType;
  maxPlatforms: number;
  isBlocked: boolean;
}

/* ============================================================
   3. PURE DOMAIN LAYOUT ENGINE
   ============================================================ */

export class LayoutEngine {
  public static validateTemplate(config: WarehouseLayoutConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.rowCount <= 0) errors.push('rowCount must be greater than 0');
    if (config.defaultBaysPerRow <= 0) errors.push('defaultBaysPerRow must be greater than 0');
    if (!config.levels || config.levels.length === 0) errors.push('At least one level must be defined');

    if (config.prefixEnabled && (!config.sides || config.sides.length === 0)) {
      errors.push('Prefix is enabled but no sides/zones are defined');
    }

    // Check ambiguous numeric adjacency without separator
    if (config.separator === '' && config.rowType === 'numeric' && config.rowPadding === 0) {
      errors.push('Ambiguous template: variable-width numeric rows adjacent to bays without separator');
    }

    // Check unique level codes
    const levelCodes = new Set<string>();
    for (const lvl of config.levels) {
      if (levelCodes.has(lvl.code)) {
        errors.push(`Duplicate level code: ${lvl.code}`);
      }
      levelCodes.add(lvl.code);
    }

    return { valid: errors.length === 0, errors };
  }

  public static formatCode(config: WarehouseLayoutConfig, loc: LocationStructured): string {
    const sep = config.separator;
    const parts: string[] = [];

    if (config.prefixEnabled && loc.side) {
      parts.push(loc.side);
    }

    let rowStr = loc.row;
    if (config.rowType === 'numeric' && config.rowPadding > 0) {
      rowStr = String(loc.row).padStart(config.rowPadding, '0');
    }
    parts.push(rowStr);

    const colStr = String(loc.column).padStart(config.bayPadding, '0');
    parts.push(colStr);

    parts.push(loc.level);

    return parts.join(sep);
  }

  public static parseCode(config: WarehouseLayoutConfig, code: string): LocationStructured | null {
    if (!code || typeof code !== 'string') return null;

    if (config.separator !== '') {
      const parts = code.split(config.separator);
      let idx = 0;
      let side: string | undefined;

      if (config.prefixEnabled) {
        if (parts.length < 4) return null;
        side = parts[idx++];
        if (!config.sides.some(s => s.code === side)) return null;
      } else {
        if (parts.length < 3) return null;
      }

      const row = parts[idx++];
      const colStr = parts[idx++];
      const level = parts[idx++];

      const column = parseInt(colStr, 10);
      if (isNaN(column)) return null;

      const lvlMatch = config.levels.find(l => l.code === level);
      if (!lvlMatch) return null;

      return { side, row, column, level };
    } else {
      // No separator (e.g., EH14D)
      let remaining = code;
      let side: string | undefined;

      if (config.prefixEnabled) {
        const matchingSide = config.sides.find(s => remaining.startsWith(s.code));
        if (!matchingSide) return null;
        side = matchingSide.code;
        remaining = remaining.slice(side.length);
      }

      let row = '';
      if (config.rowType === 'alpha') {
        const alphaMatch = remaining.match(/^[A-Za-z]+/);
        if (!alphaMatch) return null;
        row = alphaMatch[0].toUpperCase();
        remaining = remaining.slice(row.length);
      } else {
        if (config.rowPadding > 0) {
          row = remaining.slice(0, config.rowPadding);
          remaining = remaining.slice(config.rowPadding);
        } else {
          return null;
        }
      }

      const bayLen = config.bayPadding > 0 ? config.bayPadding : 2;
      const colStr = remaining.slice(0, bayLen);
      const column = parseInt(colStr, 10);
      if (isNaN(column)) return null;
      remaining = remaining.slice(bayLen);

      const level = remaining;
      const lvlMatch = config.levels.find(l => l.code === level);
      if (!lvlMatch) return null;

      return { side, row, column, level };
    }
  }

  public static validateCode(config: WarehouseLayoutConfig, code: string): boolean {
    const parsed = this.parseCode(config, code);
    if (!parsed) return false;

    // Check row validity
    if (config.rowType === 'alpha') {
      const startChar = typeof config.rowStart === 'string' ? config.rowStart.charCodeAt(0) : 65;
      const endChar = startChar + config.rowCount - 1;
      const targetChar = parsed.row.charCodeAt(0);
      if (targetChar < startChar || targetChar > endChar) return false;
    } else {
      const startNum = typeof config.rowStart === 'number' ? config.rowStart : parseInt(config.rowStart as string, 10) || 1;
      const endNum = startNum + config.rowCount - 1;
      const parsedNum = parseInt(parsed.row, 10);
      if (parsedNum < startNum || parsedNum > endNum) return false;
    }

    // Check bay range
    const maxBays = config.bayOverrides?.[parsed.row] ?? config.defaultBaysPerRow;
    if (parsed.column < 1 || parsed.column > maxBays) return false;

    return true;
  }

  public static generateLocations(config: WarehouseLayoutConfig): WarehouseLocationEntity[] {
    const locations: WarehouseLocationEntity[] = [];
    const validation = this.validateTemplate(config);
    if (!validation.valid) {
      throw new Error(`Invalid layout configuration: ${validation.errors.join(', ')}`);
    }

    const sides = config.prefixEnabled ? config.sides.map(s => s.code) : [undefined];

    const rows: string[] = [];
    if (config.rowType === 'alpha') {
      const startCharCode = typeof config.rowStart === 'string' ? config.rowStart.charCodeAt(0) : 65;
      for (let i = 0; i < config.rowCount; i++) {
        rows.push(String.fromCharCode(startCharCode + i));
      }
    } else {
      const startNum = typeof config.rowStart === 'number' ? config.rowStart : parseInt(config.rowStart as string, 10) || 1;
      for (let i = 0; i < config.rowCount; i++) {
        rows.push(String(startNum + i));
      }
    }

    for (const side of sides) {
      rows.forEach((row, rowIndex) => {
        const baysCount = config.bayOverrides?.[row] ?? config.defaultBaysPerRow;

        for (let col = 1; col <= baysCount; col++) {
          const bayKey = `${row}-${col}`;
          const isBlocked = config.blockedBays?.includes(bayKey) ?? false;

          config.levels.forEach((lvl, lvlIndex) => {
            const structured: LocationStructured = { side, row, column: col, level: lvl.code };
            const code = this.formatCode(config, structured);

            const x = col * config.bayWidthMeters;
            const y = rowIndex * config.aisleWidthMeters;
            const z = lvl.heightMeters;

            locations.push({
              id: `loc_${code.replace(/[^A-Za-z0-9]/g, '_')}`,
              layoutVersion: config.version,
              workspaceId: config.workspaceId,
              code,
              structured,
              coordinates: { x, y, z },
              accessType: lvl.accessType,
              maxPlatforms: config.defaultPlatformsPerLocation,
              isBlocked
            });
          });
        }
      });
    }

    return locations;
  }

  public static computeDistance(
    config: WarehouseLayoutConfig,
    a: LocationStructured,
    b: LocationStructured,
    verticalPenalty: number = 2.0
  ): number {
    const rowIndexA = typeof a.row === 'string' && isNaN(Number(a.row)) ? a.row.charCodeAt(0) - 65 : Number(a.row);
    const rowIndexB = typeof b.row === 'string' && isNaN(Number(b.row)) ? b.row.charCodeAt(0) - 65 : Number(b.row);

    const xA = a.column * config.bayWidthMeters;
    const xB = b.column * config.bayWidthMeters;

    const yA = rowIndexA * config.aisleWidthMeters;
    const yB = rowIndexB * config.aisleWidthMeters;

    const lvlA = config.levels.find(l => l.code === a.level)?.heightMeters ?? 0;
    const lvlB = config.levels.find(l => l.code === b.level)?.heightMeters ?? 0;

    const dx = Math.abs(xA - xB);
    const dy = Math.abs(yA - yB);
    const dz = Math.abs(lvlA - lvlB);

    return dx + dy + verticalPenalty * dz;
  }
}

/* ============================================================
   4. IN-MEMORY DETERMINISTIC REPOSITORY IMPLEMENTATIONS (PHASE A)
   ============================================================ */

export class InMemoryInventoryLedgerRepository implements InventoryLedgerRepository {
  private movements: StockMovementLedgerEntry[] = [];
  private reservations: StockReservation[] = [];
  private idempotencyKeys = new Set<string>();

  public async appendMovement(entry: StockMovementLedgerEntry): Promise<StockMovementLedgerEntry> {
    if (this.idempotencyKeys.has(entry.idempotencyKey)) {
      // Idempotency: return existing movement without re-applying
      const existing = this.movements.find(m => m.idempotencyKey === entry.idempotencyKey);
      if (existing) return existing;
    }

    this.idempotencyKeys.add(entry.idempotencyKey);
    this.movements.push({ ...entry });
    return entry;
  }

  public async getMovements(workspaceId: string): Promise<StockMovementLedgerEntry[]> {
    return this.movements.filter(m => m.workspaceId === workspaceId);
  }

  public async createReservation(reservation: StockReservation): Promise<StockReservation> {
    const balances = await this.getCurrentStock(reservation.workspaceId, reservation.sku);
    const targetBalance = balances.find(b => b.muId === reservation.muId);

    const available = targetBalance ? targetBalance.availableUnits : 0;
    if (available < reservation.quantityUnits) {
      throw new Error(`Insufficient available stock for reservation. Available: ${available}, requested: ${reservation.quantityUnits}`);
    }

    this.reservations.push({ ...reservation });
    return reservation;
  }

  public async releaseReservation(reservationId: string): Promise<void> {
    const idx = this.reservations.findIndex(r => r.reservationId === reservationId);
    if (idx !== -1) {
      this.reservations.splice(idx, 1);
    }
  }

  public async getCurrentStock(workspaceId: string, sku?: string): Promise<CurrentStockBalance[]> {
    const map = new Map<string, { onHand: number; reserved: number; locationId: string; muId: string; sku: string }>();

    // Replay append-only ledger
    for (const mov of this.movements) {
      if (mov.workspaceId !== workspaceId) continue;
      if (sku && mov.sku !== sku) continue;
      if (!mov.toMuId) continue;

      const key = `${mov.sku}_${mov.toMuId}`;
      const cur = map.get(key) ?? {
        onHand: 0,
        reserved: 0,
        locationId: mov.toLocationId || 'unplaced',
        muId: mov.toMuId,
        sku: mov.sku
      };

      if (mov.movementType === 'RECEIPT' || mov.movementType === 'ADJUSTMENT' || mov.movementType === 'REPLENISHMENT') {
        cur.onHand += mov.quantityUnits;
      } else if (mov.movementType === 'PICK') {
        cur.onHand = Math.max(0, cur.onHand - mov.quantityUnits);
      }

      if (mov.toLocationId) cur.locationId = mov.toLocationId;
      map.set(key, cur);
    }

    // Tally active reservations
    for (const res of this.reservations) {
      if (res.workspaceId !== workspaceId || res.status !== 'RESERVED') continue;
      if (sku && res.sku !== sku) continue;

      const key = `${res.sku}_${res.muId}`;
      const cur = map.get(key);
      if (cur) {
        cur.reserved += res.quantityUnits;
      }
    }

    return Array.from(map.values()).map(v => ({
      sku: v.sku,
      muId: v.muId,
      locationId: v.locationId,
      onHandUnits: v.onHand,
      reservedUnits: v.reserved,
      availableUnits: Math.max(0, v.onHand - v.reserved)
    }));
  }
}

export class InMemoryWarehouseLayoutRepository implements WarehouseLayoutRepository {
  private layouts: WarehouseLayoutConfig[] = [];

  public async getActiveLayout(workspaceId: string): Promise<WarehouseLayoutConfig | null> {
    const list = this.layouts.filter(l => l.workspaceId === workspaceId);
    if (list.length === 0) return null;
    return list.sort((a, b) => b.version - a.version)[0];
  }

  public async saveLayoutVersion(layout: WarehouseLayoutConfig): Promise<WarehouseLayoutConfig> {
    const existing = await this.getActiveLayout(layout.workspaceId);
    const nextVersion = existing ? existing.version + 1 : 1;
    const versioned = { ...layout, version: nextVersion };
    this.layouts.push(versioned);
    return versioned;
  }

  public async getLayoutHistory(workspaceId: string): Promise<WarehouseLayoutConfig[]> {
    return this.layouts.filter(l => l.workspaceId === workspaceId).sort((a, b) => b.version - a.version);
  }
}

export * from './connectors';
