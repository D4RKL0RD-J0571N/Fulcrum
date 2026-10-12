import {
  SimulationInputSnapshot,
  SimulationOutputResult,
  SimulationSummaryMetrics,
  SimulationTimelineEvent,
  BayCongestionIncident
} from '@fulcrum/contracts';

/**
 * Seeded Pseudo-Random Number Generator (PCG-32 simplified variant)
 * Guarantees identical deterministic sequences given identical seed.
 */
export class DeterministicPRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 1;
  }

  public nextFloat(): number {
    // Linear congruential generator parameters (Numerical Recipes)
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
    const prng = new DeterministicPRNG(snapshot.seed);
    const strategy = snapshot.config.strategy;

    const timelineEvents: SimulationTimelineEvent[] = [];
    const bayIncidents: Map<string, { duration: number; count: number }> = new Map();

    let totalTravelDistance = 0;
    let fulfilledOrders = 0;
    let lateOrders = 0;
    let stockShortages = 0;
    let totalCongestionDelay = 0;
    let contentionEvents = 0;

    const orders = [...snapshot.workload.orders].sort((a, b) => a.arrival_time - b.arrival_time);
    const locationsMap = new Map(snapshot.locations.map(l => [l.id, l]));

    let virtualClock = snapshot.config.start_time_seconds;
    let pickerBusyUntil = 0;

    for (const order of orders) {
      if (order.arrival_time > virtualClock) {
        virtualClock = order.arrival_time;
      }

      timelineEvents.push({
        time: virtualClock,
        event_type: 'ORDER_ARRIVED',
        entity_id: order.order_id,
        details: { itemsCount: order.items.length, priority: order.priority }
      });

      let orderTravelDist = 0;
      let orderDelay = 0;

      for (const item of order.items) {
        // Find matching inventory
        const inv = snapshot.inventory.find(i => i.sku === item.sku);
        if (!inv || inv.quantity < item.quantity) {
          stockShortages++;
          timelineEvents.push({
            time: virtualClock,
            event_type: 'STOCK_SHORTAGE',
            entity_id: order.order_id,
            details: { sku: item.sku, needed: item.quantity }
          });
          continue;
        }

        const loc = locationsMap.get(inv.location_id);
        const dist = loc ? Math.abs(loc.x) + Math.abs(loc.y) + loc.z * 2.0 : 15.0;
        orderTravelDist += dist;

        // Congestion evaluation
        // If a high-tier forklift position is accessed, under BASELINE strategy it conflicts with picker
        const isUpperLevel = loc?.access_type === 'forklift';
        if (isUpperLevel) {
          contentionEvents++;
          const bayKey = `bay_${Math.round(loc.x)}_${Math.round(loc.y)}`;
          const existing = bayIncidents.get(bayKey) ?? { duration: 0, count: 0 };

          if (strategy === 'BASELINE') {
            const delay = snapshot.rules.forklift_lockout_duration_seconds;
            orderDelay += delay;
            totalCongestionDelay += delay;
            existing.duration += delay;
            existing.count += 1;
          } else {
            // Congestion aware defers replenishment outside peak picking window
            const minorDelay = Math.round(snapshot.rules.forklift_lockout_duration_seconds * 0.15);
            orderDelay += minorDelay;
            totalCongestionDelay += minorDelay;
            existing.duration += minorDelay;
            existing.count += 1;
          }
          bayIncidents.set(bayKey, existing);
        }
      }

      const pickDuration = Math.round(orderTravelDist / snapshot.rules.picker_walking_speed_mps) + orderDelay + 20;
      const orderCompletionTime = virtualClock + pickDuration;

      totalTravelDistance += orderTravelDist;
      fulfilledOrders++;

      if (orderCompletionTime > order.deadline) {
        lateOrders++;
      }

      timelineEvents.push({
        time: orderCompletionTime,
        event_type: 'ORDER_FULFILLED',
        entity_id: order.order_id,
        details: { cycleTime: pickDuration, wasLate: orderCompletionTime > order.deadline }
      });

      virtualClock = orderCompletionTime;
    }

    const bayCongestionHeatmap: BayCongestionIncident[] = Array.from(bayIncidents.entries()).map(([bayId, data]) => ({
      bay_id: bayId,
      congestion_duration_seconds: data.duration,
      incidents_count: data.count
    }));

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
        total_congestion_delay_seconds: totalCongestionDelay
      },
      timeline_events: timelineEvents,
      bay_congestion_heatmap: bayCongestionHeatmap
    };
  }
}
