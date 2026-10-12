using System.Diagnostics;
using Fulcrum.SimWorker.Model;

namespace Fulcrum.SimWorker.Engine;

public sealed class DeterministicPRNG
{
    private uint _state;

    public DeterministicPRNG(int seed)
    {
        _state = (uint)seed;
        if (_state == 0) _state = 1;
    }

    public double NextDouble()
    {
        _state = (1664525u * _state + 1013904223u);
        return (double)_state / 4294967296.0;
    }

    public int NextInt(int min, int max)
    {
        return (int)Math.Floor(min + NextDouble() * (max - min + 1));
    }
}

public interface ISimulationEngineService
{
    SimulationOutputResult ExecuteRun(SimulationInputSnapshot snapshot);
}

public sealed class DeterministicSimulationEngine : ISimulationEngineService
{
    public SimulationOutputResult ExecuteRun(SimulationInputSnapshot snapshot)
    {
        var stopwatch = Stopwatch.StartNew();
        var strategy = snapshot.Config.Strategy;

        int totalTravelDistanceMeters = 0;
        int fulfilledOrders = 0;
        int lateOrders = 0;
        int stockShortages = 0;
        int totalCongestionDelay = 0;
        int contentionEvents = 0;
        int redundantMuTrips = 0;
        int platformExtractions = 0;
        int cageShuffles = 0;

        var orders = snapshot.Workload.Orders
            .OrderBy(o => o.ArrivalTime)
            .ToList();

        var locationsMap = snapshot.Locations
            .ToDictionary(l => l.Id);

        // Inventory map by SKU -> first matching inventory item with positive balance
        var inventoryMap = new Dictionary<string, SimulationInventoryItem>();
        foreach (var item in snapshot.Inventory)
        {
            if (!inventoryMap.ContainsKey(item.Sku) && item.QuantityUnits > 0)
            {
                inventoryMap[item.Sku] = item;
            }
        }

        int virtualClock = snapshot.Config.StartTimeSeconds;
        string? lastVisitedMuId = null;
        (double X, double Y, double Z) currentPickerLocation = (0, 0, 0);

        if (strategy == "BATCH_WAVE_ROUTING" || strategy == "CONGESTION_AWARE")
        {
            for (int i = 0; i < orders.Count; i++)
            {
                var order = orders[i];
                if (order.ArrivalTime > virtualClock)
                {
                    virtualClock = order.ArrivalTime;
                }

                double orderTravelDist = 0;
                int pickDelay = 0;

                foreach (var item in order.Items)
                {
                    if (!inventoryMap.TryGetValue(item.Sku, out var inv) || inv.QuantityUnits < item.QuantityUnits)
                    {
                        stockShortages++;
                        continue;
                    }

                    locationsMap.TryGetValue(inv.LocationId, out var loc);
                    var targetLoc = loc != null ? (loc.X, loc.Y, loc.Z) : (10.0, 10.0, 0.5);

                    if (lastVisitedMuId == inv.MuId)
                    {
                        // zero transit distance: already in front of this MU!
                        orderTravelDist += 0;
                        pickDelay += snapshot.Rules.PiecePickSeconds * item.QuantityUnits;
                    }
                    else
                    {
                        double dist = Math.Abs(currentPickerLocation.X - targetLoc.Item1) +
                                     Math.Abs(currentPickerLocation.Y - targetLoc.Item2) +
                                     Math.Abs(currentPickerLocation.Z - targetLoc.Item3) * 2.0;
                        orderTravelDist += dist;
                        currentPickerLocation = targetLoc;

                        if (loc != null && loc.Z <= 0.8)
                        {
                            platformExtractions++;
                            pickDelay += snapshot.Rules.PlatformDrawPenaltySeconds;
                        }

                        if (inv.PlatformId == "plat_inner_2")
                        {
                            cageShuffles++;
                            pickDelay += snapshot.Rules.BoxShufflePenaltySeconds;
                        }

                        pickDelay += snapshot.Rules.PiecePickSeconds * item.QuantityUnits;
                        lastVisitedMuId = inv.MuId;
                    }

                    if (loc?.AccessType == "forklift")
                    {
                        contentionEvents++;
                        int delay = (int)Math.Round(snapshot.Rules.ForkliftLockoutDurationSeconds * 0.15);
                        pickDelay += delay;
                        totalCongestionDelay += delay;
                    }
                }

                // Return to packing station
                double returnDist = Math.Abs(currentPickerLocation.X) + Math.Abs(currentPickerLocation.Y);
                orderTravelDist += returnDist;
                currentPickerLocation = (0, 0, 0);

                int duration = (int)Math.Round(orderTravelDist / snapshot.Rules.PickerWalkingSpeedMps) + pickDelay;
                int completionTime = virtualClock + duration;

                totalTravelDistanceMeters += (int)Math.Round(orderTravelDist);
                fulfilledOrders++;
                if (completionTime > order.Deadline) lateOrders++;
                virtualClock = completionTime;
            }
        }
        else
        {
            // BASELINE discrete picking
            for (int i = 0; i < orders.Count; i++)
            {
                var order = orders[i];
                if (order.ArrivalTime > virtualClock)
                {
                    virtualClock = order.ArrivalTime;
                }

                double orderTravelDist = 0;
                int pickDelay = 0;

                foreach (var item in order.Items)
                {
                    if (!inventoryMap.TryGetValue(item.Sku, out var inv) || inv.QuantityUnits < item.QuantityUnits)
                    {
                        stockShortages++;
                        continue;
                    }

                    locationsMap.TryGetValue(inv.LocationId, out var loc);
                    var targetLoc = loc != null ? (loc.X, loc.Y, loc.Z) : (10.0, 10.0, 0.5);

                    double distToLoc = Math.Abs(targetLoc.Item1) + Math.Abs(targetLoc.Item2) + Math.Abs(targetLoc.Item3) * 2.0;
                    orderTravelDist += distToLoc;

                    if (lastVisitedMuId == inv.MuId)
                    {
                        redundantMuTrips++;
                    }
                    lastVisitedMuId = inv.MuId;

                    if (loc != null && loc.Z <= 0.8)
                    {
                        platformExtractions++;
                        pickDelay += snapshot.Rules.PlatformDrawPenaltySeconds;
                    }

                    if (inv.PlatformId == "plat_inner_2")
                    {
                        cageShuffles++;
                        pickDelay += snapshot.Rules.BoxShufflePenaltySeconds;
                    }

                    pickDelay += snapshot.Rules.PiecePickSeconds * item.QuantityUnits;

                    if (loc?.AccessType == "forklift")
                    {
                        contentionEvents++;
                        int delay = snapshot.Rules.ForkliftLockoutDurationSeconds;
                        pickDelay += delay;
                        totalCongestionDelay += delay;
                    }

                    orderTravelDist += distToLoc;
                }

                int duration = (int)Math.Round(orderTravelDist / snapshot.Rules.PickerWalkingSpeedMps) + pickDelay;
                int completionTime = virtualClock + duration;

                totalTravelDistanceMeters += (int)Math.Round(orderTravelDist);
                fulfilledOrders++;
                if (completionTime > order.Deadline) lateOrders++;
                virtualClock = completionTime;
            }
        }

        stopwatch.Stop();
        double avgCycleTime = fulfilledOrders > 0 ? (double)(virtualClock - snapshot.Config.StartTimeSeconds) / fulfilledOrders : 0;
        double pickerUtil = Math.Min(0.95, Math.Round(((fulfilledOrders * 120.0) / Math.Max(1, virtualClock)) * 100.0) / 100.0);

        return new SimulationOutputResult(
            ContractVersion: "1.0.0",
            RunId: $"sim_run_{snapshot.Seed}_{strategy.ToLowerInvariant()}",
            SnapshotHash: snapshot.SnapshotHash,
            Strategy: strategy,
            Seed: snapshot.Seed,
            ExecutionWallTimeMs: stopwatch.ElapsedMilliseconds,
            SummaryMetrics: new SimulationSummaryMetrics(
                TotalOrders: orders.Count,
                FulfilledOrders: fulfilledOrders,
                LateOrders: lateOrders,
                StockShortages: stockShortages,
                TotalTravelDistanceMeters: Math.Round((double)totalTravelDistanceMeters * 10.0) / 10.0,
                AverageOrderCycleTimeSeconds: Math.Round(avgCycleTime * 10.0) / 10.0,
                PickerUtilizationRatio: pickerUtil,
                ForkliftContentionEvents: contentionEvents,
                TotalCongestionDelaySeconds: totalCongestionDelay,
                RedundantMuTrips: redundantMuTrips,
                PlatformExtractionEvents: platformExtractions,
                CageShuffleEvents: cageShuffles
            ),
            TimelineEvents: new List<object>(),
            BayCongestionHeatmap: new List<object>()
        );
    }
}
