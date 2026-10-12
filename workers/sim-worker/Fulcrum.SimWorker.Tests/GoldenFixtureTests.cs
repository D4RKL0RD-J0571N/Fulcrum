using Fulcrum.SimWorker.Engine;
using Fulcrum.SimWorker.Model;
using Xunit;

namespace Fulcrum.SimWorker.Tests;

public class GoldenFixtureTests
{
    private readonly SimulationInputSnapshot _goldenSnapshot = new(
        ContractVersion: "1.0.0",
        SnapshotId: "snap_golden_01",
        SnapshotHash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        WorkspaceId: "ws_default",
        Seed: 48213,
        Config: new SimulationConfig(
            StartTimeSeconds: 0,
            DurationSeconds: 28800,
            Strategy: "BASELINE"
        ),
        Rules: new SimulationRules(
            CongestionRadiusMeters: 2.5,
            CongestionSlowdownFactor: 0.5,
            ForkliftLockoutDurationSeconds: 180,
            PickerWalkingSpeedMps: 1.2,
            ForkliftSpeedMps: 2.0,
            PlatformDrawPenaltySeconds: 18,
            BoxShufflePenaltySeconds: 25,
            PiecePickSeconds: 6
        ),
        Locations: new List<SimulationLocation>
        {
            new("loc_EH14A", 16.8, 17.5, 0.5, "manual", 2, false),
            new("loc_EH14B", 16.8, 17.5, 2.0, "manual", 2, false),
            new("loc_EH14D", 16.8, 17.5, 5.5, "forklift", 2, false),
            new("loc_EC07A", 8.4, 5.0, 0.5, "manual", 2, false)
        },
        Inventory: new List<SimulationInventoryItem>
        {
            new("502900", "loc_EH14A", "1524289001", 6),
            new("502900", "loc_EH14A", "1524289002", 5),
            new("101003", "loc_EH14D", "1524289004", 6),
            new("202005", "loc_EC07A", "1524289001", 12)
        },
        Workload: new SimulationWorkload(
            Orders: new List<SimulationOrder>
            {
                new("000815296", 0, 3600, "HIGH", new List<SimulationOrderItem> { new("l1", "1524289001", 1) }),
                new("000815297", 60, 3600, "HIGH", new List<SimulationOrderItem> { new("l2", "1524289002", 1) }),
                new("000815298", 120, 3600, "STANDARD", new List<SimulationOrderItem> { new("l3", "1524289004", 1) })
            }
        )
    );

    [Fact]
    public void ProducesByteIdenticalBaselineResultsMatchingTypeScriptFixture()
    {
        var engine = new DeterministicSimulationEngine();
        var runA = engine.ExecuteRun(_goldenSnapshot);
        var runB = engine.ExecuteRun(_goldenSnapshot);

        Assert.Equal(runA.SummaryMetrics, runB.SummaryMetrics);
        Assert.Equal(3, runA.SummaryMetrics.TotalOrders);
        Assert.Equal(3, runA.SummaryMetrics.FulfilledOrders);
        Assert.Equal(0, runA.SummaryMetrics.LateOrders);
        Assert.Equal(0, runA.SummaryMetrics.StockShortages);
        Assert.Equal(1, runA.SummaryMetrics.RedundantMuTrips);
        Assert.Equal(2, runA.SummaryMetrics.PlatformExtractionEvents);
        Assert.Equal(1, runA.SummaryMetrics.ForkliftContentionEvents);
    }

    [Fact]
    public void BatchWaveRoutingEliminatesRedundantMuTrips()
    {
        var engine = new DeterministicSimulationEngine();
        var batchSnapshot = _goldenSnapshot with
        {
            Config = _goldenSnapshot.Config with { Strategy = "BATCH_WAVE_ROUTING" }
        };

        var batchRun = engine.ExecuteRun(batchSnapshot);
        var baselineRun = engine.ExecuteRun(_goldenSnapshot);

        Assert.Equal(0, batchRun.SummaryMetrics.RedundantMuTrips);
        Assert.True(batchRun.SummaryMetrics.TotalTravelDistanceMeters < baselineRun.SummaryMetrics.TotalTravelDistanceMeters);
    }
}
