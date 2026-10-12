import { z } from 'zod';
import { LocationAccessType, LocationAccessTypeSchema } from '@fulcrum/contracts';

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
  blockedBays?: string[]; // e.g., ["H-12", "A-01"]
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
