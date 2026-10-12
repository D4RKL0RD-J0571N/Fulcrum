import {
  SimulationInputSnapshot,
  SimulationOutputResult,
  SimulationSummaryMetrics,
  SimulationTimelineEvent,
  BayCongestionIncident
} from '@fulcrum/contracts';

/**
 * Seeded Pseudo-Random Number Generator (PCG-32 simplified variant)
 */
export class DeterministicPRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 1;
  }

  public nextFloat(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  public nextInt(min: number, max: number): number {
    return Math.floor(min + this.nextFloat() * (max - min + 1));
  }
}

export interface SimulationEngineService {
  executeRun(snapshot: SimulationInputSnapshot): SimulationOutputResult;
}

export class PureTypeScriptSimulationEngine implements SimulationEngineService {
  public executeRun(snapshot: SimulationInputSnapshot): SimulationOutputResult {
    const startTime = Date.now();
    const strategy = snapshot.config.strategy;

    const timelineEvents: SimulationTimelineEvent[] = [];
    const bayIncidents: Map<string, { duration: number; count: number }> = new Map();

    let totalTravelDistance = 0;
    let fulfilledOrders = 0;
    let lateOrders = 0;
    let stockShortages = 0;
    let totalCongestionDelay = 0;
    let contentionEvents = 0;
    let redundantMuTrips = 0;
    let platformExtractions = 0;
    let cageShuffles = 0;

    const orders = [...snapshot.workload.orders].sort((a, b) => a.arrival_time - b.arrival_time);
    const locationsMap = new Map(snapshot.locations.map(l => [l.id, l]));

    // Inventory map by SKU -> first matching inventory item with positive balance
    const inventoryMap = new Map<string, typeof snapshot.inventory[0]>();
    for (const item of snapshot.inventory) {
      if (!inventoryMap.has(item.sku) && item.quantity_units > 0) {
        inventoryMap.set(item.sku, item);
      }
    }

    let virtualClock = snapshot.config.start_time_seconds;
    let lastVisitedMuId: string | null = null;
    let currentPickerLocation = { x: 0, y: 0, z: 0 }; // Packing/Staging origin

    if (strategy === 'BATCH_WAVE_ROUTING' || strategy === 'CONGESTION_AWARE') {
      // BATCH WAVE: Orders with items sharing the same MU are grouped in pick batches
      // Picker visits the MU once and collects items for multiple active orders
      const orderMuMap = new Map<string, Set<string>>();
      orders.forEach(o => {
        const mus = new Set<string>();
        o.items.forEach(it => {
          const inv = inventoryMap.get(it.sku);
          if (inv) mus.add(inv.mu_id);
        });
        orderMuMap.set(o.order_id, mus);
      });

      for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        if (order.arrival_time > virtualClock) {
          virtualClock = order.arrival_time;
        }

        let orderTravelDist = 0;
        let pickDelay = 0;

        for (const item of order.items) {
          const inv = inventoryMap.get(item.sku);
          if (!inv || inv.quantity_units < item.quantity_units) {
            stockShortages++;
            continue;
          }

          const loc = locationsMap.get(inv.location_id);
          const targetLoc = loc ? { x: loc.x, y: loc.y, z: loc.z } : { x: 10, y: 10, z: 0.5 };

          // If identical to last MU picked in this wave, the picker is already at this MU!
          if (lastVisitedMuId === inv.mu_id) {
            // zero transit distance: already in front of this MU!
            orderTravelDist += 0;
            // only item pick time
            pickDelay += snapshot.rules.piece_pick_seconds * item.quantity_units;
          } else {
            const dist = Math.abs(currentPickerLocation.x - targetLoc.x) +
                         Math.abs(currentPickerLocation.y - targetLoc.y) +
                         Math.abs(currentPickerLocation.z - targetLoc.z) * 2.0;
            orderTravelDist += dist;
            currentPickerLocation = targetLoc;

            // Physical extraction handling:
            // Level A manual platform draw-out
            if (loc && loc.z <= 0.8) {
              platformExtractions++;
              pickDelay += snapshot.rules.platform_draw_penalty_seconds;
            }

            // Moving cages to access inner MU
            if (inv.platform_id === 'plat_inner_2') {
              cageShuffles++;
              pickDelay += snapshot.rules.box_shuffle_penalty_seconds;
            }

            pickDelay += snapshot.rules.piece_pick_seconds * item.quantity_units;
            lastVisitedMuId = inv.mu_id;
          }

          // Forklift contention check
          if (loc?.access_type === 'forklift') {
            contentionEvents++;
            const delay = Math.round(snapshot.rules.forklift_lockout_duration_seconds * 0.15);
            pickDelay += delay;
            totalCongestionDelay += delay;
          }
        }

        // Return to pack station
        const returnDist = Math.abs(currentPickerLocation.x) + Math.abs(currentPickerLocation.y);
        orderTravelDist += returnDist;
        currentPickerLocation = { x: 0, y: 0, z: 0 };

        const duration = Math.round(orderTravelDist / snapshot.rules.picker_walking_speed_mps) + pickDelay;
        const completionTime = virtualClock + duration;

        totalTravelDistance += orderTravelDist;
        fulfilledOrders++;
        if (completionTime > order.deadline) lateOrders++;
        virtualClock = completionTime;
      }
    } else {
      // BASELINE: Discrete individual order picking without batching across orders.
      // If order N and order N+1 share the exact same SKU in the same MU,
      // picker delivers order N to pack station, then travels back to the SAME MU for order N+1!
      for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        if (order.arrival_time > virtualClock) {
          virtualClock = order.arrival_time;
        }

        let orderTravelDist = 0;
        let pickDelay = 0;

        for (const item of order.items) {
          const inv = inventoryMap.get(item.sku);
          if (!inv || inv.quantity_units < item.quantity_units) {
            stockShortages++;
            continue;
          }

          const loc = locationsMap.get(inv.location_id);
          const targetLoc = loc ? { x: loc.x, y: loc.y, z: loc.z } : { x: 10, y: 10, z: 0.5 };

          // Picker starts trip from packing station (0,0,0) to target location
          const distToLoc = Math.abs(targetLoc.x) + Math.abs(targetLoc.y) + Math.abs(targetLoc.z) * 2.0;
          orderTravelDist += distToLoc;

          // Check redundant visit to the same MU as previous order
          if (lastVisitedMuId === inv.mu_id) {
            redundantMuTrips++;
          }
          lastVisitedMuId = inv.mu_id;

          // Physical extraction penalty: Level A platform pull-out
          if (loc && loc.z <= 0.8) {
            platformExtractions++;
            pickDelay += snapshot.rules.platform_draw_penalty_seconds;
          }

          // Shuffling cages/boxes
          if (inv.platform_id === 'plat_inner_2') {
            cageShuffles++;
            pickDelay += snapshot.rules.box_shuffle_penalty_seconds;
          }

          pickDelay += snapshot.rules.piece_pick_seconds * item.quantity_units;

          // Forklift contention lockout in baseline
          if (loc?.access_type === 'forklift') {
            contentionEvents++;
            const delay = snapshot.rules.forklift_lockout_duration_seconds;
            pickDelay += delay;
            totalCongestionDelay += delay;
          }

          // Return to packing station (0,0,0) with this order's item
          orderTravelDist += distToLoc;
        }

        const duration = Math.round(orderTravelDist / snapshot.rules.picker_walking_speed_mps) + pickDelay;
        const completionTime = virtualClock + duration;

        totalTravelDistance += orderTravelDist;
        fulfilledOrders++;
        if (completionTime > order.deadline) lateOrders++;
        virtualClock = completionTime;
      }
    }

    const wallTime = Date.now() - startTime;
    const avgCycleTime = fulfilledOrders > 0 ? (virtualClock - snapshot.config.start_time_seconds) / fulfilledOrders : 0;

    return {
      contract_version: '1.0.0',
      run_id: `sim_run_${snapshot.seed}_${strategy.toLowerCase()}`,
      snapshot_hash: snapshot.snapshot_hash,
      strategy,
      seed: snapshot.seed,
      execution_wall_time_ms: wallTime,
      summary_metrics: {
        total_orders: orders.length,
        fulfilled_orders: fulfilledOrders,
        late_orders: lateOrders,
        stock_shortages: stockShortages,
        total_travel_distance_meters: Math.round(totalTravelDistance * 10) / 10,
        average_order_cycle_time_seconds: Math.round(avgCycleTime * 10) / 10,
        picker_utilization_ratio: Math.min(0.95, Math.round(((fulfilledOrders * 120) / Math.max(1, virtualClock)) * 100) / 100),
        forklift_contention_events: contentionEvents,
        total_congestion_delay_seconds: totalCongestionDelay,
        redundant_mu_trips: redundantMuTrips,
        platform_extraction_events: platformExtractions,
        cage_shuffle_events: cageShuffles
      },
      timeline_events: timelineEvents,
      bay_congestion_heatmap: []
    };
  }
}
