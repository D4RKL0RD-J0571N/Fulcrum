using System.Text.Json.Serialization;

namespace Fulcrum.SimWorker.Model;

public sealed record SimulationRules(
    [property: JsonPropertyName("congestion_radius_meters")] double CongestionRadiusMeters = 2.5,
    [property: JsonPropertyName("congestion_slowdown_factor")] double CongestionSlowdownFactor = 0.5,
    [property: JsonPropertyName("forklift_lockout_duration_seconds")] int ForkliftLockoutDurationSeconds = 180,
    [property: JsonPropertyName("picker_walking_speed_mps")] double PickerWalkingSpeedMps = 1.2,
    [property: JsonPropertyName("forklift_speed_mps")] double ForkliftSpeedMps = 2.0,
    [property: JsonPropertyName("platform_draw_penalty_seconds")] int PlatformDrawPenaltySeconds = 18,
    [property: JsonPropertyName("box_shuffle_penalty_seconds")] int BoxShufflePenaltySeconds = 25,
    [property: JsonPropertyName("piece_pick_seconds")] int PiecePickSeconds = 6
);

public sealed record SimulationLocation(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("x")] double X,
    [property: JsonPropertyName("y")] double Y,
    [property: JsonPropertyName("z")] double Z,
    [property: JsonPropertyName("access_type")] string AccessType,
    [property: JsonPropertyName("capacity")] int Capacity,
    [property: JsonPropertyName("is_blocked")] bool IsBlocked = false
);

public sealed record SimulationInventoryItem(
    [property: JsonPropertyName("mu_id")] string MuId,
    [property: JsonPropertyName("location_id")] string LocationId,
    [property: JsonPropertyName("sku")] string Sku,
    [property: JsonPropertyName("quantity_units")] int QuantityUnits,
    [property: JsonPropertyName("platform_id")] string? PlatformId = null
);

public sealed record SimulationOrderItem(
    [property: JsonPropertyName("line_id")] string LineId,
    [property: JsonPropertyName("sku")] string Sku,
    [property: JsonPropertyName("quantity_units")] int QuantityUnits
);

public sealed record SimulationOrder(
    [property: JsonPropertyName("order_id")] string OrderId,
    [property: JsonPropertyName("arrival_time")] int ArrivalTime,
    [property: JsonPropertyName("deadline")] int Deadline,
    [property: JsonPropertyName("priority")] string Priority,
    [property: JsonPropertyName("items")] List<SimulationOrderItem> Items
);

public sealed record SimulationWorkload(
    [property: JsonPropertyName("orders")] List<SimulationOrder> Orders,
    [property: JsonPropertyName("replenishment_triggers")] List<object>? ReplenishmentTriggers = null
);

public sealed record SimulationConfig(
    [property: JsonPropertyName("start_time_seconds")] int StartTimeSeconds,
    [property: JsonPropertyName("duration_seconds")] int DurationSeconds,
    [property: JsonPropertyName("strategy")] string Strategy
);

public sealed record SimulationInputSnapshot(
    [property: JsonPropertyName("contract_version")] string ContractVersion,
    [property: JsonPropertyName("snapshot_id")] string SnapshotId,
    [property: JsonPropertyName("snapshot_hash")] string SnapshotHash,
    [property: JsonPropertyName("workspace_id")] string WorkspaceId,
    [property: JsonPropertyName("seed")] int Seed,
    [property: JsonPropertyName("config")] SimulationConfig Config,
    [property: JsonPropertyName("rules")] SimulationRules Rules,
    [property: JsonPropertyName("locations")] List<SimulationLocation> Locations,
    [property: JsonPropertyName("inventory")] List<SimulationInventoryItem> Inventory,
    [property: JsonPropertyName("workload")] SimulationWorkload Workload,
    [property: JsonPropertyName("resources")] object? Resources = null
);

public sealed record SimulationSummaryMetrics(
    [property: JsonPropertyName("total_orders")] int TotalOrders,
    [property: JsonPropertyName("fulfilled_orders")] int FulfilledOrders,
    [property: JsonPropertyName("late_orders")] int LateOrders,
    [property: JsonPropertyName("stock_shortages")] int StockShortages,
    [property: JsonPropertyName("total_travel_distance_meters")] double TotalTravelDistanceMeters,
    [property: JsonPropertyName("average_order_cycle_time_seconds")] double AverageOrderCycleTimeSeconds,
    [property: JsonPropertyName("picker_utilization_ratio")] double PickerUtilizationRatio,
    [property: JsonPropertyName("forklift_contention_events")] int ForkliftContentionEvents,
    [property: JsonPropertyName("total_congestion_delay_seconds")] int TotalCongestionDelaySeconds,
    [property: JsonPropertyName("redundant_mu_trips")] int RedundantMuTrips,
    [property: JsonPropertyName("platform_extraction_events")] int PlatformExtractionEvents,
    [property: JsonPropertyName("cage_shuffle_events")] int CageShuffleEvents
);

public sealed record SimulationOutputResult(
    [property: JsonPropertyName("contract_version")] string ContractVersion,
    [property: JsonPropertyName("run_id")] string RunId,
    [property: JsonPropertyName("snapshot_hash")] string SnapshotHash,
    [property: JsonPropertyName("strategy")] string Strategy,
    [property: JsonPropertyName("seed")] int Seed,
    [property: JsonPropertyName("execution_wall_time_ms")] long ExecutionWallTimeMs,
    [property: JsonPropertyName("summary_metrics")] SimulationSummaryMetrics SummaryMetrics,
    [property: JsonPropertyName("timeline_events")] List<object> TimelineEvents,
    [property: JsonPropertyName("bay_congestion_heatmap")] List<object> BayCongestionHeatmap
);
