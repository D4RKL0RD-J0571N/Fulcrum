# Fulcrum — Warehouse Location Model Specification

## 1. Overview and Core Philosophy

In Fulcrum, **nothing about the warehouse layout is hard-coded**. The system is completely data-driven:
- No hard-coded prefix (e.g. `E`).
- No fixed row count or column count.
- No predetermined level counts, letters, or access assumptions.
- No hard-coded platform capacity or manipulation unit limits.

The layout is a **versioned domain object** that defines how storage locations are addressed, parsed, formatted, validated, and mapped into physical coordinates.

---

## 2. Segment Structure & Template Rules

In v1, the segment order is fixed to:
`[side?][row][column][level]`

*(Arbitrary segment reordering is deferred to a future enhancement behind an ADR).*

### Segment Definitions

| Segment | Required | Configuration Properties | Description & Rules |
|---|---|---|---|
| **Side / Prefix** | Optional (default off) | `enabled: boolean`, `allowed_values: { code: string, label: string }[]` | When enabled, represents warehouse zones or operational sides (e.g., `E` = E-commerce, `S` = Store replenishment). Each side maintains its own row and level parameters. |
| **Row** | Required | `type: 'alpha' | 'numeric'`, `start: string | number`, `count: number | explicit_list: string[]`, `padding: number` | Alphabetic (e.g. `A`-`Z`) or numeric (e.g. `01`-`50`). Zero-padded if numeric. |
| **Column (Bay)** | Required | `type: 'numeric'`, `start: number`, `bays_per_row: number | Record<string, number>`, `padding: number` | Bay index along the row. Supports uniform counts or per-row variations (e.g. Row A has 20 bays, Row H has 14 bays). |
| **Level** | Required | `levels: { code: string, label: string, access_type: 'manual' | 'forklift' | 'any' }[]` | Ordered list of levels bottom-to-top. Access type is explicitly declared per level, not inferred from code letters. |
| **Separator** | Optional (default none) | `separator: '' | '-' | '.'` | Delimiter between segments (e.g., `EH14D` vs `E-H-14-D` vs `08.14.B`). |

---

## 3. Template Validation & Ambiguity Rejection

A template is strictly validated before it can be persisted:
1. **Ambiguous Variable-Width Segments:** If two adjacent segments have variable widths and no separator exists between them (e.g. numeric rows without fixed padding adjacent to numeric columns without fixed padding), the template is rejected as unparseable.
2. **Duplicate Identifiers:** Duplicate side codes or duplicate level codes within a layout version are rejected.
3. **Empty Sequences:** Rows, bays, or levels with count `0` are rejected.
4. **Ascending Level Order:** Level definitions must be specified in strict physical bottom-to-top order.

---

## 4. Pure Domain Layout Module API

The layout module is pure and dependency-free:

```typescript
export interface LocationStructured {
  side?: string;
  row: string;
  column: number;
  level: string;
}

export interface PhysicalCoordinates {
  x: number; // meters from warehouse origin
  y: number; // meters along aisle
  z: number; // height meters from floor
}

export interface LayoutEngine {
  // 1. Generate all valid location models from layout
  generateLocations(layout: WarehouseLayout): LocationEntity[];

  // 2. Format structured coordinates to string
  formatCode(layout: WarehouseLayout, coords: LocationStructured): string;

  // 3. Parse string code to structured coordinates (or throws/returns null)
  parseCode(layout: WarehouseLayout, code: string): LocationStructured | null;

  // 4. Validate whether code belongs to active layout
  validateCode(layout: WarehouseLayout, code: string): boolean;

  // 5. Calculate physical travel distance between two locations
  computeDistance(layout: WarehouseLayout, a: LocationStructured, b: LocationStructured): number;
}
```

---

## 5. Three Worked Layout Configurations

### Layout A: Seed Reference (Prefix, Alpha Rows, Uniform Bays, Forklift Upper Level)
- **Side:** Enabled. Values: `[{ code: 'E', label: 'E-commerce' }]`.
- **Row:** Alpha, start `'A'`, end `'Z'` (26 rows).
- **Column (Bay):** Numeric, start `1`, count `20` (except Row `'H'` with `14`), padding `2`.
- **Levels:**
  - `A`: Ground Level (access: `manual`, height: 0.5m)
  - `B`: Mid Level 1 (access: `manual`, height: 2.0m)
  - `C`: Mid Level 2 (access: `manual`, height: 3.5m)
  - `D`: High Level (access: `forklift`, height: 5.5m)
- **Separator:** None (`""`).
- **Sample Code:** `EH14D`
- **Distance Model:** Bay width = 1.2m, aisle width = 2.5m, level height = 1.5m.

### Layout B: No Prefix, Alpha Rows, Dash Separator
- **Side:** Disabled.
- **Row:** Alpha, start `'A'`, count `10` (`A` through `J`).
- **Column (Bay):** Numeric, start `1`, count `30`, padding `2`.
- **Levels:**
  - `L1`: Ground (access: `manual`, height: 0.0m)
  - `L2`: Upper (access: `manual`, height: 2.2m)
- **Separator:** `"-"`.
- **Sample Code:** `H-14-L1`

### Layout C: Numeric Rows, Dot Separator, 3 Levels
- **Side:** Disabled.
- **Row:** Numeric, start `1`, count `12`, padding `2` (`01` through `12`).
- **Column (Bay):** Numeric, start `1`, count `15`, padding `2` (`01` through `15`).
- **Levels:**
  - `B`: Bottom (access: `manual`, height: 0.2m)
  - `M`: Middle (access: `manual`, height: 1.8m)
  - `T`: Top (access: `forklift`, height: 3.6m)
- **Separator:** `"."`.
- **Sample Code:** `08.14.B`

---

## 6. Physical Distance Calculation

Travel distance between locations $L_1$ and $L_2$ is computed from physical coordinates:
1. $X$: Along-rack position: $X = \text{column} \times \text{bay\_width}$.
2. $Y$: Aisle position: $Y = \text{row\_index} \times \text{aisle\_width}$.
3. $Z$: Vertical elevation: $Z = \text{level\_elevation}$.

### Distance Formula:
$$\text{Distance} = |\Delta X| + |\Delta Y| + \text{vertical\_penalty} \times |\Delta Z|$$

Where $\text{vertical\_penalty}$ accounts for the lift/lower velocity delta of industrial equipment.

---

## 7. Layout Versioning & Safe Migration
- Modifying warehouse topography produces a new version (`layout_version + 1`).
- Existing MUs and inventory ledgers permanently record the `layout_version_id` under which they were placed.
- If a position is removed or blocked in a new layout version:
  1. The migration pipeline detects affected MUs.
  2. Planners are presented with an explicit reallocation / evacuation workflow.
  3. No inventory is ever silently orphaned or deleted.
