/**
 * Fulcrum Minimal Domain Model & Deterministic Material Planning Engine
 *
 * Implements order-specific material demand aggregation, physical manipulation unit (MU)
 * collection planning, and allocation against externally reported, offline stock observations.
 */

export interface Material {
  sku: string;
  name?: string;
}

export interface OrderRequirementLine {
  lineId: string;
  materialSku: string;
  requestedQuantity: number;
  materialName?: string;
}

export interface Order {
  orderId: string;
  priority?: 'HIGH' | 'STANDARD' | 'LOW';
  createdAt: number;
  notes?: string;
  lines: OrderRequirementLine[];
}

export interface StockObservation {
  observationId: string;
  materialSku: string;
  observedQuantity: number;
  muId?: string | null; // e.g. "502900" or undefined/null for loose/uncontainerized stock
  location?: string | null; // e.g. "EC07A" or undefined/null for unspecified
  observedAt: number; // Unix timestamp (ms)
  notes?: string;
}

export interface PlanningOptions {
  staleThresholdMinutes?: number; // default: 60 mins
  referenceTime?: number; // default: Date.now()
  runId?: string; // Optional custom/deterministic plan identifier
  /**
   * Bay codes currently locked out due to active replenishment or forklift operations (e.g. ['EH14', 'EC07']).
   * When a bay is locked out, manual pickers cannot enter that bay until the lockout is cleared.
   */
  lockedOutBays?: string[];
  /**
   * When true, stock on Level D (forklift-only) or in locked-out bays requires forklift equipment or clearance.
   * Accessible stock is strongly preferred. If restricted stock is used, it flags requiresIntervention.
   */
  restrictForkliftLocations?: boolean;
}

export interface AllocationLine {
  allocationId: string;
  orderId: string;
  lineId: string;
  materialSku: string;
  allocatedQuantity: number;
  muId?: string; // Physical manipulation unit from which stock is drawn
  location?: string;
  observationId: string;
  observationTimestamp: number;
}

export interface OrderAllocationDetail {
  orderId: string;
  lineId: string;
  quantity: number;
}

export interface ItemExtractionLine {
  materialSku: string;
  materialName?: string;
  quantity: number;
  allocations: OrderAllocationDetail[];
}

/**
 * Represents a single physical collection action for a worker:
 * either a specific container/MU (with all SKUs and order lines to pull from it),
 * or loose/uncontainerized stock at a location.
 */
export interface ManipulationUnitPickTask {
  taskId: string;
  muId?: string; // Specific MU identifier (e.g. "502900"), or undefined for loose stock
  isLoose: boolean;
  location: string; // Known location string, "Location unspecified", or "Location Conflict (EA01A vs EB02B)"
  isUnspecifiedLocation: boolean;
  hasLocationConflict?: boolean; // True if observations place this physical MU in multiple distinct locations
  conflictingLocations?: string[]; // Sorted list of distinct conflicting locations reported for this MU
  totalPieces: number; // Total physical pieces to extract from this unit
  isStale: boolean;
  observationTimestamp: number;
  fulfillingOrderIds: string[]; // Distinct order IDs supported by this unit
  items: ItemExtractionLine[]; // Items and quantities to extract
  // Access and operational restrictions
  accessRestriction?: 'NONE' | 'LEVEL_D_FORKLIFT' | 'BAY_LOCKED_OUT';
  isAccessible?: boolean; // False if on Level D or in a locked-out bay
  requiresIntervention?: boolean; // True if requires forklift equipment or lockout clearance
}

// Alias for backwards-compatibility
export type PickListItem = ManipulationUnitPickTask;

export interface ShortageReport {
  orderId: string;
  lineId: string;
  materialSku: string;
  materialName?: string;
  requestedQuantity: number;
  fulfilledQuantity: number;
  shortageQuantity: number;
  reason: 'NO_OBSERVATIONS' | 'INSUFFICIENT_OBSERVED_STOCK';
}

export interface MaterialDemandSummary {
  materialSku: string;
  materialName?: string;
  totalRequested: number;
  totalAllocated: number;
  totalShortage: number;
  availableObservedQuantity: number;
  contributingLocations: string[];
  contributingMUs: string[];
}

export interface PlanningWarning {
  code: 'STALE_OBSERVATION' | 'UNSPECIFIED_LOCATION' | 'PARTIAL_FULFILLMENT' | 'TOTAL_SHORTAGE' | 'CONFLICTING_MU_LOCATION' | 'LEVEL_D_RESTRICTED' | 'BAY_LOCKED_OUT';
  message: string;
  materialSku?: string;
  location?: string;
  muId?: string;
  orderId?: string;
  conflictingLocations?: string[];
  bay?: string;
}

export interface PlanningSummary {
  totalOrdersSelected: number;
  fullyFulfilledOrders: number;
  partiallyFulfilledOrders: number;
  unfulfilledOrders: number;
  // Distinct counts: physical manipulation units vs piece quantities
  totalManipulationUnitsToCollect: number; // Count of distinct containerized MUs (!isLoose)
  totalLooseStockTasks: number; // Count of loose collection locations
  totalPiecesRequested: number;
  totalPiecesAllocated: number;
  totalPiecesShortage: number;
  staleObservationsCount: number;
  // Operational readiness & conflict flags
  hasUnresolvedConflicts: boolean; // True if any MU in the collection plan has conflicting locations
  conflictingMuCount: number; // Number of distinct physical MUs with conflicting locations in the plan
  hasRestrictedLocations?: boolean; // True if any pick task is on Level D or in a locked-out bay
  restrictedTaskCount?: number;
  isPlanExecutable: boolean; // False if unresolved location conflicts or access restrictions exist
  // Backward compatibility alias
  totalRequestedUnits: number;
  totalAllocatedUnits: number;
  totalShortageUnits: number;
}

export interface PlanningRun {
  runId: string;
  calculatedAt: number;
  selectedOrderIds: string[];
  inputSnapshot: {
    orders: Order[];
    activeObservations: StockObservation[];
    staleThresholdMinutes: number;
  };
  allocations: AllocationLine[];
  pickList: ManipulationUnitPickTask[];
  shortages: ShortageReport[];
  aggregatedDemand: MaterialDemandSummary[];
  warnings: PlanningWarning[];
  summary: PlanningSummary;
}

/**
 * Normalizes an MU identifier.
 * Empty, null, or whitespace-only normalizes to "" (representing loose/uncontainerized).
 */
export function normalizeMuKey(muId?: string | null): string {
  if (!muId) return '';
  return muId.trim().toUpperCase();
}

/**
 * Normalizes a location string to a canonical key.
 * Empty, null, or whitespace-only locations normalize to "" (representing unspecified location).
 */
export function normalizeLocationKey(location?: string | null): string {
  if (!location) return '';
  return location.trim().toUpperCase();
}

/**
 * Normalizes a SKU identifier.
 */
export function normalizeSkuKey(sku: string): string {
  return sku.trim().toUpperCase();
}

/**
 * Extracts normalized bay and level from a location string (e.g. "EH14D" -> bay: "EH14", level: "D").
 * Identifies Level D as forklift-only and detects bay grouping for contention lockouts.
 */
export function parseLocationBayAndLevel(location?: string | null): { bay: string; level: string; isLevelD: boolean } {
  if (!location) return { bay: '', level: '', isLevelD: false };
  const clean = location.trim().toUpperCase();
  // Strip any separators (e.g. E-H-14-D -> bay: EH14, level: D)
  const parts = clean.split(/[-._]/).filter(Boolean);
  if (parts.length >= 3) {
    const level = parts[parts.length - 1];
    const bayParts = parts.slice(0, parts.length - 1);
    return { bay: bayParts.join(''), level, isLevelD: level === 'D' || level === 'TOP' };
  }
  // Standard compact format like EH14D (Side E, Row H, Bay 14, Level D)
  const match = clean.match(/^([A-Z0-9]+?)([A-D])$/);
  if (match) {
    const bay = match[1];
    const level = match[2];
    return { bay, level, isLevelD: level === 'D' };
  }
  return { bay: clean, level: '', isLevelD: false };
}

/**
 * Resolves current applicable observations from a list of observations.
 *
 * Rules:
 * 1. For containerized stock (muId provided):
 *    - Uniquely keyed by (muKey, skuKey).
 *    - An observation refresh for SKU A in MU 502900 supersedes previous observations of SKU A in MU 502900,
 *      WITHOUT discarding observations of SKU B in MU 502900.
 *    - If an MU observation provides a newer timestamp with an updated location, the newer location applies.
 * 2. For loose/uncontainerized stock (muId empty):
 *    - Uniquely keyed by (LOOSE, locKey, skuKey).
 *    - An observation refresh for loose SKU A at location X supersedes previous loose counts at location X,
 *      without affecting loose counts at location Y or containerized counts.
 * 3. Latest observedAt timestamp wins. Tie-breaker: latest observationId.
 */
export function resolveCurrentObservations(observations: StockObservation[]): StockObservation[] {
  const currentMap = new Map<string, StockObservation>();

  for (const obs of observations) {
    if (!obs || !obs.materialSku) continue;
    const skuKey = normalizeSkuKey(obs.materialSku);
    const muKey = normalizeMuKey(obs.muId);
    const locKey = normalizeLocationKey(obs.location);

    const compoundKey = muKey.length > 0
      ? `CONTAINER::${muKey}::${skuKey}`
      : `LOOSE::${locKey}::${skuKey}`;

    const existing = currentMap.get(compoundKey);
    if (!existing) {
      currentMap.set(compoundKey, { ...obs });
    } else {
      // Latest observedAt supersedes
      if (
        obs.observedAt > existing.observedAt ||
        (obs.observedAt === existing.observedAt && obs.observationId > existing.observationId)
      ) {
        currentMap.set(compoundKey, { ...obs });
      }
    }
  }

  return Array.from(currentMap.values());
}

/**
 * Deterministic Order Material & Manipulation Unit Planner
 */
export class OrderMaterialPlanner {
  /**
   * Calculates a proposed picking plan for a selected set of orders against
   * provided stock observations.
   *
   * Invariants guaranteed:
   * 1. Deterministic allocation ordering:
   *    Order priority (HIGH -> STANDARD -> LOW) -> createdAt ascending -> orderId ascending.
   * 2. Explicit MU Consolidation preference:
   *    When fulfilling a line, prefers MUs already selected in the plan, then physical MUs with known locations,
   *    then unlocated MUs, then loose stock.
   * 3. Physical MU tracking:
   *    Multiple SKUs drawn from the same MU aggregate into a single physical collection task.
   * 4. Distinct MU counting:
   *    totalManipulationUnitsToCollect counts only distinct physical MUs (!isLoose).
   * 5. Strict conservation: allocations from an observation never exceed observedQuantity.
   * 6. Reproducibility & snapshot immutability: returns a pure snapshot without mutating inputs.
   */
  public static calculatePlan(
    allOrders: Order[],
    selectedOrderIds: string[],
    observations: StockObservation[],
    options: PlanningOptions = {}
  ): PlanningRun {
    const calculatedAt = options.referenceTime ?? Date.now();
    const staleThresholdMinutes = options.staleThresholdMinutes ?? 60;
    const staleThresholdMs = staleThresholdMinutes * 60 * 1000;
    const lockedOutBaysSet = new Set((options.lockedOutBays ?? []).map(b => normalizeLocationKey(b)));
    const restrictForklift = options.restrictForkliftLocations ?? false;

    // 1. Filter to selected orders only
    const selectedSet = new Set(selectedOrderIds);
    const selectedOrders = allOrders
      .filter(o => selectedSet.has(o.orderId))
      .map(o => ({
        ...o,
        lines: o.lines.map(l => ({ ...l }))
      }));

    // Deterministic sort of orders:
    // Priority (HIGH = 3, STANDARD = 2, LOW = 1, default = 2) -> createdAt ascending -> orderId ascending
    const priorityWeight = (p?: string) => (p === 'HIGH' ? 3 : p === 'LOW' ? 1 : 2);
    selectedOrders.sort((a, b) => {
      const pDiff = priorityWeight(b.priority) - priorityWeight(a.priority);
      if (pDiff !== 0) return pDiff;
      if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
      return a.orderId.localeCompare(b.orderId);
    });

    // 2. Resolve current active observations (deduplicating by container/loose key)
    const activeObservations = resolveCurrentObservations(observations);
    const snapshotObservations = activeObservations.map(o => ({ ...o }));

    // 2b. Build canonical MU location and conflict registry
    interface MuLocationInfo {
      muId: string;
      knownLocations: string[]; // Distinct non-empty original location strings
      hasConflict: boolean;
      conflictingLocations: string[];
      resolvedLocation: string;
      isUnspecified: boolean;
    }

    const muLocationMap = new Map<string, MuLocationInfo>();
    for (const obs of activeObservations) {
      const muKey = normalizeMuKey(obs.muId);
      if (!muKey) continue;

      let info = muLocationMap.get(muKey);
      if (!info) {
        info = {
          muId: obs.muId!.trim(),
          knownLocations: [],
          hasConflict: false,
          conflictingLocations: [],
          resolvedLocation: 'Location unspecified',
          isUnspecified: true
        };
        muLocationMap.set(muKey, info);
      }

      const normLoc = normalizeLocationKey(obs.location);
      if (normLoc.length > 0) {
        const rawLoc = obs.location!.trim();
        if (!info.knownLocations.some(l => normalizeLocationKey(l) === normLoc)) {
          info.knownLocations.push(rawLoc);
        }
      }
    }

    for (const [, info] of muLocationMap.entries()) {
      info.knownLocations.sort();
      if (info.knownLocations.length > 1) {
        info.hasConflict = true;
        info.conflictingLocations = [...info.knownLocations];
        info.resolvedLocation = `Location Conflict (${info.conflictingLocations.join(' vs ')})`;
        info.isUnspecified = false;
      } else if (info.knownLocations.length === 1) {
        info.hasConflict = false;
        info.conflictingLocations = [];
        info.resolvedLocation = info.knownLocations[0];
        info.isUnspecified = false;
      } else {
        info.hasConflict = false;
        info.conflictingLocations = [];
        info.resolvedLocation = 'Location unspecified';
        info.isUnspecified = true;
      }
    }

    // 3. Prepare working stock tracking pools
    interface StockPoolItem {
      observation: StockObservation;
      remainingQuantity: number;
      muKey: string;
      isLoose: boolean;
      normalizedLoc: string;
      isStale: boolean;
      isRestricted: boolean;
      isLockedOut: boolean;
      isLevelD: boolean;
    }

    const poolsBySku = new Map<string, StockPoolItem[]>();
    for (const obs of activeObservations) {
      const skuKey = normalizeSkuKey(obs.materialSku);
      const isStale = (calculatedAt - obs.observedAt) > staleThresholdMs;
      const muKey = normalizeMuKey(obs.muId);
      const isLoose = muKey.length === 0;
      const muInfo = muKey ? muLocationMap.get(muKey) : undefined;

      const normalizedLoc = isLoose
        ? normalizeLocationKey(obs.location)
        : (muInfo?.hasConflict ? 'CONFLICT' : (muInfo?.isUnspecified ? '' : normalizeLocationKey(muInfo?.resolvedLocation)));

      const rawLocation = obs.location || muInfo?.resolvedLocation;
      const { bay, isLevelD } = parseLocationBayAndLevel(rawLocation);
      const isLockedOut = lockedOutBaysSet.has(normalizeLocationKey(bay));
      const isRestricted = isLockedOut || (restrictForklift && isLevelD);

      const poolItem: StockPoolItem = {
        observation: { ...obs },
        remainingQuantity: Math.max(0, obs.observedQuantity),
        muKey,
        isLoose,
        normalizedLoc,
        isStale,
        isRestricted,
        isLockedOut,
        isLevelD
      };

      if (!poolsBySku.has(skuKey)) {
        poolsBySku.set(skuKey, []);
      }
      poolsBySku.get(skuKey)!.push(poolItem);
    }

    // Track physical MUs that have already been allocated to at least one order line
    const selectedMuKeys = new Set<string>();

    // 4. Allocate line by line
    const allocations: AllocationLine[] = [];
    const shortages: ShortageReport[] = [];
    const warnings: PlanningWarning[] = [];
    const warningKeys = new Set<string>();

    const addWarningOnce = (w: PlanningWarning) => {
      const key = `${w.code}:${w.materialSku || ''}:${w.location || ''}:${w.muId || ''}:${w.orderId || ''}`;
      if (!warningKeys.has(key)) {
        warningKeys.add(key);
        warnings.push(w);
      }
    };

    let allocationSeq = 1;
    const materialNamesBySku = new Map<string, string>();

    // Collect material names from orders and observations
    for (const order of selectedOrders) {
      for (const line of order.lines) {
        if (line.materialName && !materialNamesBySku.has(normalizeSkuKey(line.materialSku))) {
          materialNamesBySku.set(normalizeSkuKey(line.materialSku), line.materialName);
        }
      }
    }

    // Track order fulfillment counts
    const orderLineFulfillment = new Map<string, { totalRequested: number; totalAllocated: number }>();
    for (const order of selectedOrders) {
      orderLineFulfillment.set(order.orderId, { totalRequested: 0, totalAllocated: 0 });
    }

    for (const order of selectedOrders) {
      const ordStats = orderLineFulfillment.get(order.orderId)!;

      for (const line of order.lines) {
        const skuKey = normalizeSkuKey(line.materialSku);
        const requested = line.requestedQuantity;
        ordStats.totalRequested += requested;

        let needed = requested;
        let lineAllocated = 0;
        const candidatePools = poolsBySku.get(skuKey) || [];

        if (candidatePools.length === 0) {
          shortages.push({
            orderId: order.orderId,
            lineId: line.lineId,
            materialSku: line.materialSku,
            materialName: line.materialName || materialNamesBySku.get(skuKey),
            requestedQuantity: requested,
            fulfilledQuantity: 0,
            shortageQuantity: requested,
            reason: 'NO_OBSERVATIONS'
          });
          addWarningOnce({
            code: 'TOTAL_SHORTAGE',
            message: `No stock observations recorded for material ${line.materialSku} (Order ${order.orderId}).`,
            materialSku: line.materialSku,
            orderId: order.orderId
          });
          continue;
        }

        // Deterministic sorting of candidate pools with explicit MU Consolidation Preference:
        // Priority 0: Accessible stock over restricted stock (Level D or locked-out bays)
        // Tier 1: Already selected MUs (reusing an MU already pulled for another line/order)
        // Tier 2: Unselected physical MUs with known location (location A-Z, then muId A-Z)
        // Tier 3: Unselected physical MUs with unspecified location
        // Tier 4: Loose stock with known location
        // Tier 5: Loose stock with unspecified location
        candidatePools.sort((a, b) => {
          if (a.isRestricted !== b.isRestricted) {
            return a.isRestricted ? 1 : -1;
          }

          const aTier = !a.isLoose && selectedMuKeys.has(a.muKey) ? 1
            : !a.isLoose && a.normalizedLoc.length > 0 ? 2
            : !a.isLoose ? 3
            : a.normalizedLoc.length > 0 ? 4 : 5;

          const bTier = !b.isLoose && selectedMuKeys.has(b.muKey) ? 1
            : !b.isLoose && b.normalizedLoc.length > 0 ? 2
            : !b.isLoose ? 3
            : b.normalizedLoc.length > 0 ? 4 : 5;

          if (aTier !== bTier) return aTier - bTier;

          if (a.normalizedLoc !== b.normalizedLoc) {
            return a.normalizedLoc.localeCompare(b.normalizedLoc);
          }
          if (a.muKey !== b.muKey) {
            return a.muKey.localeCompare(b.muKey);
          }
          if (b.observation.observedAt !== a.observation.observedAt) {
            return b.observation.observedAt - a.observation.observedAt;
          }
          return a.observation.observationId.localeCompare(b.observation.observationId);
        });

        for (const pool of candidatePools) {
          if (needed <= 0) break;
          if (pool.remainingQuantity <= 0) continue;

          const toTake = Math.min(needed, pool.remainingQuantity);
          pool.remainingQuantity -= toTake;
          needed -= toTake;
          lineAllocated += toTake;

          if (!pool.isLoose && pool.muKey) {
            selectedMuKeys.add(pool.muKey);
          }

          const muKey = normalizeMuKey(pool.observation.muId);
          const muInfo = muKey ? muLocationMap.get(muKey) : undefined;
          const allocLocation = pool.isLoose
            ? (pool.observation.location?.trim() || undefined)
            : (muInfo ? (muInfo.hasConflict ? muInfo.resolvedLocation : (muInfo.isUnspecified ? undefined : muInfo.resolvedLocation)) : (pool.observation.location?.trim() || undefined));

          allocations.push({
            allocationId: `alloc_${allocationSeq++}`,
            orderId: order.orderId,
            lineId: line.lineId,
            materialSku: line.materialSku,
            allocatedQuantity: toTake,
            muId: pool.observation.muId?.trim() || undefined,
            location: allocLocation,
            observationId: pool.observation.observationId,
            observationTimestamp: pool.observation.observedAt
          });

          if (pool.isStale) {
            addWarningOnce({
              code: 'STALE_OBSERVATION',
              message: `Observation for material ${line.materialSku}${pool.observation.muId ? ` in MU ${pool.observation.muId}` : ''} at ${pool.observation.location || 'unspecified location'} is older than ${staleThresholdMinutes} minutes.`,
              materialSku: line.materialSku,
              location: pool.observation.location || undefined,
              muId: pool.observation.muId || undefined
            });
          }

          if (pool.normalizedLoc.length === 0) {
            addWarningOnce({
              code: 'UNSPECIFIED_LOCATION',
              message: `Material ${line.materialSku}${pool.observation.muId ? ` in MU ${pool.observation.muId}` : ''} allocated without a known location.`,
              materialSku: line.materialSku,
              muId: pool.observation.muId || undefined
            });
          }
        }

        ordStats.totalAllocated += lineAllocated;

        if (needed > 0) {
          shortages.push({
            orderId: order.orderId,
            lineId: line.lineId,
            materialSku: line.materialSku,
            materialName: line.materialName || materialNamesBySku.get(skuKey),
            requestedQuantity: requested,
            fulfilledQuantity: lineAllocated,
            shortageQuantity: needed,
            reason: 'INSUFFICIENT_OBSERVED_STOCK'
          });
          addWarningOnce({
            code: 'PARTIAL_FULFILLMENT',
            message: `Order ${order.orderId} line for ${line.materialSku} has a shortage of ${needed} units.`,
            materialSku: line.materialSku,
            orderId: order.orderId
          });
        }
      }
    }

    // 5. Build consolidated Manipulation Unit Pick Tasks
    // Group allocations by physical unit:
    // - For containerized stock: group by muKey
    // - For loose stock: group by normalizedLoc
    const taskMap = new Map<string, {
      muId?: string;
      isLoose: boolean;
      location: string;
      isUnspecifiedLocation: boolean;
      hasLocationConflict: boolean;
      conflictingLocations?: string[];
      observationTimestamp: number;
      isStale: boolean;
      orderIdSet: Set<string>;
      itemsMap: Map<string, { materialSku: string; materialName?: string; quantity: number; allocations: OrderAllocationDetail[] }>;
    }>();

    for (const alloc of allocations) {
      const muKey = normalizeMuKey(alloc.muId);
      const isLoose = muKey.length === 0;
      const muInfo = muKey ? muLocationMap.get(muKey) : undefined;
      const locKey = normalizeLocationKey(alloc.location);

      const isConflict = !isLoose && !!muInfo?.hasConflict;
      const isUnspec = isLoose ? locKey.length === 0 : (muInfo ? muInfo.isUnspecified : locKey.length === 0);
      const displayLoc = isLoose
        ? (locKey.length === 0 ? 'Location unspecified' : (alloc.location?.trim() || 'Location unspecified'))
        : (muInfo ? muInfo.resolvedLocation : (locKey.length === 0 ? 'Location unspecified' : (alloc.location?.trim() || 'Location unspecified')));

      const isStale = (calculatedAt - alloc.observationTimestamp) > staleThresholdMs;

      const groupKey = isLoose ? `LOOSE::${locKey}` : `MU::${muKey}`;

      let taskGroup = taskMap.get(groupKey);
      if (!taskGroup) {
        taskGroup = {
          muId: alloc.muId?.trim() || undefined,
          isLoose,
          location: displayLoc,
          isUnspecifiedLocation: isUnspec,
          hasLocationConflict: isConflict,
          conflictingLocations: isConflict ? muInfo?.conflictingLocations : undefined,
          observationTimestamp: alloc.observationTimestamp,
          isStale,
          orderIdSet: new Set<string>(),
          itemsMap: new Map()
        };
        taskMap.set(groupKey, taskGroup);

        if (isConflict && muInfo) {
          addWarningOnce({
            code: 'CONFLICTING_MU_LOCATION',
            message: `Manipulation Unit ${muInfo.muId} is associated with conflicting locations: ${muInfo.conflictingLocations.join(' vs ')}. Physical location must be resolved before collection.`,
            muId: muInfo.muId,
            conflictingLocations: muInfo.conflictingLocations
          });
        }
      }

      taskGroup.orderIdSet.add(alloc.orderId);
      if (alloc.observationTimestamp > taskGroup.observationTimestamp) {
        taskGroup.observationTimestamp = alloc.observationTimestamp;
      }
      if (isStale) taskGroup.isStale = true;

      const skuKey = normalizeSkuKey(alloc.materialSku);
      let itemLine = taskGroup.itemsMap.get(skuKey);
      if (!itemLine) {
        itemLine = {
          materialSku: alloc.materialSku,
          materialName: materialNamesBySku.get(skuKey),
          quantity: 0,
          allocations: []
        };
        taskGroup.itemsMap.set(skuKey, itemLine);
      }
      itemLine.quantity += alloc.allocatedQuantity;
      itemLine.allocations.push({
        orderId: alloc.orderId,
        lineId: alloc.lineId,
        quantity: alloc.allocatedQuantity
      });
    }

    // Convert task groups to ManipulationUnitPickTask array
    let taskSeq = 1;
    const pickList: ManipulationUnitPickTask[] = Array.from(taskMap.values()).map(g => {
      const items = Array.from(g.itemsMap.values()).sort((a, b) => a.materialSku.localeCompare(b.materialSku));
      const totalPieces = items.reduce((sum, it) => sum + it.quantity, 0);
      const fulfillingOrderIds = Array.from(g.orderIdSet).sort();

      const { bay, isLevelD } = parseLocationBayAndLevel(g.location);
      const isLockedOut = lockedOutBaysSet.has(normalizeLocationKey(bay));
      const isForklift = isLevelD;

      let accessRestriction: 'NONE' | 'LEVEL_D_FORKLIFT' | 'BAY_LOCKED_OUT' = 'NONE';
      let isAccessible = true;
      let requiresIntervention = false;

      if (isLockedOut) {
        accessRestriction = 'BAY_LOCKED_OUT';
        isAccessible = false;
        requiresIntervention = true;
        addWarningOnce({
          code: 'BAY_LOCKED_OUT',
          message: `Bay ${bay} is currently locked out due to active replenishment operations. Manual picker access is blocked until the lockout is cleared.`,
          location: g.location,
          muId: g.muId,
          bay
        });
      } else if (restrictForklift && isForklift) {
        accessRestriction = 'LEVEL_D_FORKLIFT';
        isAccessible = false;
        requiresIntervention = true;
        addWarningOnce({
          code: 'LEVEL_D_RESTRICTED',
          message: `Stock at ${g.location} is on Level D (forklift-only) and requires forklift equipment/operator.`,
          location: g.location,
          muId: g.muId,
          bay
        });
      }

      return {
        taskId: `task_${taskSeq++}`,
        muId: g.muId,
        isLoose: g.isLoose,
        location: g.location,
        isUnspecifiedLocation: g.isUnspecifiedLocation,
        hasLocationConflict: g.hasLocationConflict,
        conflictingLocations: g.conflictingLocations,
        totalPieces,
        isStale: g.isStale,
        observationTimestamp: g.observationTimestamp,
        fulfillingOrderIds,
        items,
        accessRestriction,
        isAccessible,
        requiresIntervention
      };
    });

    // Sort pick tasks deterministically:
    // 1. Conflicting MUs requiring resolution at the top
    // 2. Tasks requiring intervention (locked bay or Level D)
    // 3. Containerized MUs with known location (location A-Z, then muId A-Z)
    // 4. Containerized MUs with unspecified location
    // 5. Loose stock with known location
    // 6. Loose stock with unspecified location
    pickList.sort((a, b) => {
      const aTier = a.hasLocationConflict ? 0
        : a.requiresIntervention ? 1
        : !a.isLoose && !a.isUnspecifiedLocation ? 2
        : !a.isLoose ? 3
        : !a.isUnspecifiedLocation ? 4 : 5;
      const bTier = b.hasLocationConflict ? 0
        : b.requiresIntervention ? 1
        : !b.isLoose && !b.isUnspecifiedLocation ? 2
        : !b.isLoose ? 3
        : !b.isUnspecifiedLocation ? 4 : 5;

      if (aTier !== bTier) return aTier - bTier;

      const locCmp = a.location.localeCompare(b.location);
      if (locCmp !== 0) return locCmp;

      const aMu = a.muId || '';
      const bMu = b.muId || '';
      return aMu.localeCompare(bMu);
    });

    // 6. Build Aggregated Demand Summary
    const demandBySku = new Map<string, { requested: number; allocated: number; shortage: number }>();
    for (const order of selectedOrders) {
      for (const line of order.lines) {
        const skuKey = normalizeSkuKey(line.materialSku);
        if (!demandBySku.has(skuKey)) {
          demandBySku.set(skuKey, { requested: 0, allocated: 0, shortage: 0 });
        }
        demandBySku.get(skuKey)!.requested += line.requestedQuantity;
      }
    }
    for (const alloc of allocations) {
      const skuKey = normalizeSkuKey(alloc.materialSku);
      if (demandBySku.has(skuKey)) {
        demandBySku.get(skuKey)!.allocated += alloc.allocatedQuantity;
      }
    }
    for (const sh of shortages) {
      const skuKey = normalizeSkuKey(sh.materialSku);
      if (demandBySku.has(skuKey)) {
        demandBySku.get(skuKey)!.shortage += sh.shortageQuantity;
      }
    }

    const aggregatedDemand: MaterialDemandSummary[] = [];
    for (const [skuKey, dem] of demandBySku) {
      const candidatePools = poolsBySku.get(skuKey) || [];
      const totalObserved = candidatePools.reduce((sum, p) => sum + p.observation.observedQuantity, 0);
      const contributingLocs = Array.from(
        new Set(
          candidatePools
            .map(p => p.observation.location?.trim() || 'Unspecified')
        )
      );
      const contributingMUs = Array.from(
        new Set(
          candidatePools
            .map(p => p.observation.muId?.trim() || 'Loose / None')
        )
      );

      const originalLine = selectedOrders.flatMap(o => o.lines).find(l => normalizeSkuKey(l.materialSku) === skuKey);
      const skuDisplay = originalLine?.materialSku || skuKey;

      aggregatedDemand.push({
        materialSku: skuDisplay,
        materialName: materialNamesBySku.get(skuKey),
        totalRequested: dem.requested,
        totalAllocated: dem.allocated,
        totalShortage: dem.shortage,
        availableObservedQuantity: totalObserved,
        contributingLocations: contributingLocs,
        contributingMUs
      });
    }

    aggregatedDemand.sort((a, b) => a.materialSku.localeCompare(b.materialSku));

    // 7. Calculate overall summary statistics
    let fullyFulfilled = 0;
    let partiallyFulfilled = 0;
    let unfulfilled = 0;
    let totalPiecesRequested = 0;
    let totalPiecesAllocated = 0;

    for (const [, stats] of orderLineFulfillment) {
      totalPiecesRequested += stats.totalRequested;
      totalPiecesAllocated += stats.totalAllocated;
      if (stats.totalAllocated === stats.totalRequested && stats.totalRequested > 0) {
        fullyFulfilled++;
      } else if (stats.totalAllocated > 0 && stats.totalAllocated < stats.totalRequested) {
        partiallyFulfilled++;
      } else {
        unfulfilled++;
      }
    }
    const totalPiecesShortage = totalPiecesRequested - totalPiecesAllocated;

    // Distinct physical MUs to collect (excludes loose stock)
    const totalManipulationUnitsToCollect = pickList.filter(t => !t.isLoose).length;
    const totalLooseStockTasks = pickList.filter(t => t.isLoose).length;

    const hasUnresolvedConflicts = pickList.some(t => !!t.hasLocationConflict);
    const conflictingMuCount = pickList.filter(t => !!t.hasLocationConflict).length;
    const hasRestrictedLocations = pickList.some(t => !!t.requiresIntervention);
    const restrictedTaskCount = pickList.filter(t => !!t.requiresIntervention).length;
    const isPlanExecutable = !hasUnresolvedConflicts && !hasRestrictedLocations;

    const staleObservationsCount = activeObservations.filter(
      o => (calculatedAt - o.observedAt) > staleThresholdMs
    ).length;

    const runId = options.runId ?? `RUN-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`;

    const summary: PlanningSummary = {
      totalOrdersSelected: selectedOrders.length,
      fullyFulfilledOrders: fullyFulfilled,
      partiallyFulfilledOrders: partiallyFulfilled,
      unfulfilledOrders: unfulfilled,
      totalManipulationUnitsToCollect,
      totalLooseStockTasks,
      totalPiecesRequested,
      totalPiecesAllocated,
      totalPiecesShortage,
      staleObservationsCount,
      hasUnresolvedConflicts,
      conflictingMuCount,
      hasRestrictedLocations,
      restrictedTaskCount,
      isPlanExecutable,
      totalRequestedUnits: totalPiecesRequested,
      totalAllocatedUnits: totalPiecesAllocated,
      totalShortageUnits: totalPiecesShortage
    };

    return {
      runId,
      calculatedAt,
      selectedOrderIds: [...selectedOrderIds],
      inputSnapshot: {
        orders: selectedOrders,
        activeObservations: snapshotObservations,
        staleThresholdMinutes
      },
      allocations,
      pickList,
      shortages,
      aggregatedDemand,
      warnings,
      summary
    };
  }
}
