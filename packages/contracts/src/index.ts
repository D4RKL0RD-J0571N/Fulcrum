import { z } from 'zod';

export const LocationAccessTypeSchema = z.enum(['manual', 'forklift', 'any']);
export type LocationAccessType = z.infer<typeof LocationAccessTypeSchema>;

export const SimulationLocationSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  access_type: LocationAccessTypeSchema,
  capacity: z.number().int().positive().default(2),
  is_blocked: z.boolean().default(false)
});
export type SimulationLocation = z.infer<typeof SimulationLocationSchema>;

export const SimulationInventoryItemSchema = z.object({
  mu_id: z.string(),
  location_id: z.string(),
  sku: z.string(),
  quantity: z.number().int().nonnegative()
});
export type SimulationInventoryItem = z.infer<typeof SimulationInventoryItemSchema>;

export const SimulationOrderItemSchema = z.object({
  sku: z.string(),
  quantity: z.number().int().positive()
});

export const SimulationOrderSchema = z.object({
  order_id: z.string(),
  arrival_time: z.number().int().nonnegative(),
  deadline: z.number().int().positive(),
  priority: z.enum(['CRITICAL', 'HIGH', 'STANDARD', 'LOW']).default('STANDARD'),
  items: z.array(SimulationOrderItemSchema)
});
export type SimulationOrder = z.infer<typeof SimulationOrderSchema>;

export const SimulationReplenishmentTriggerSchema = z.object({
  trigger_id: z.string(),
  sku: z.string(),
  threshold_quantity: z.number().int().positive(),
  target_location_id: z.string(),
  source_location_id: z.string()
});
export type SimulationReplenishmentTrigger = z.infer<typeof SimulationReplenishmentTriggerSchema>;

export const SimulationResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  speed_mps: z.number().positive().default(1.2)
});
export type SimulationResource = z.infer<typeof SimulationResourceSchema>;

export const SimulationStrategySchema = z.enum(['BASELINE', 'CONGESTION_AWARE']);
export type SimulationStrategy = z.infer<typeof SimulationStrategySchema>;

export const SimulationRulesSchema = z.object({
  congestion_radius_meters: z.number().default(2.5),
  congestion_slowdown_factor: z.number().default(0.5),
  forklift_lockout_duration_seconds: z.number().int().default(180),
  picker_walking_speed_mps: z.number().default(1.2),
  forklift_speed_mps: z.number().default(2.0)
});
export type SimulationRules = z.infer<typeof SimulationRulesSchema>;

export const SimulationInputSnapshotSchema = z.object({
  contract_version: z.literal('1.0.0'),
  snapshot_id: z.string(),
  snapshot_hash: z.string(),
  workspace_id: z.string(),
  seed: z.number().int(),
  config: z.object({
    start_time_seconds: z.number().int().default(0),
    duration_seconds: z.number().int().default(28800),
    strategy: SimulationStrategySchema
  }),
  rules: SimulationRulesSchema,
  locations: z.array(SimulationLocationSchema),
  inventory: z.array(SimulationInventoryItemSchema),
  workload: z.object({
    orders: z.array(SimulationOrderSchema),
    replenishment_triggers: z.array(SimulationReplenishmentTriggerSchema).default([])
  }),
  resources: z.object({
    manual_pickers: z.array(SimulationResourceSchema),
    forklifts: z.array(SimulationResourceSchema)
  })
});
export type SimulationInputSnapshot = z.infer<typeof SimulationInputSnapshotSchema>;

export const SimulationSummaryMetricsSchema = z.object({
  total_orders: z.number().int(),
  fulfilled_orders: z.number().int(),
  late_orders: z.number().int(),
  stock_shortages: z.number().int(),
  total_travel_distance_meters: z.number(),
  average_order_cycle_time_seconds: z.number(),
  picker_utilization_ratio: z.number(),
  forklift_contention_events: z.number().int(),
  total_congestion_delay_seconds: z.number().int()
});
export type SimulationSummaryMetrics = z.infer<typeof SimulationSummaryMetricsSchema>;

export const SimulationTimelineEventSchema = z.object({
  time: z.number().int(),
  event_type: z.string(),
  entity_id: z.string(),
  resource_id: z.string().optional(),
  location_id: z.string().optional(),
  details: z.record(z.any()).optional()
});
export type SimulationTimelineEvent = z.infer<typeof SimulationTimelineEventSchema>;

export const BayCongestionIncidentSchema = z.object({
  bay_id: z.string(),
  congestion_duration_seconds: z.number().int(),
  incidents_count: z.number().int()
});
export type BayCongestionIncident = z.infer<typeof BayCongestionIncidentSchema>;

export const SimulationOutputResultSchema = z.object({
  contract_version: z.literal('1.0.0'),
  run_id: z.string(),
  snapshot_hash: z.string(),
  strategy: SimulationStrategySchema,
  seed: z.number().int(),
  execution_wall_time_ms: z.number(),
  summary_metrics: SimulationSummaryMetricsSchema,
  timeline_events: z.array(SimulationTimelineEventSchema),
  bay_congestion_heatmap: z.array(BayCongestionIncidentSchema)
});
export type SimulationOutputResult = z.infer<typeof SimulationOutputResultSchema>;
