using System.Diagnostics;
using Fulcrum.SimWorker.Engine;
using Fulcrum.SimWorker.Model;
using Xunit;

namespace Fulcrum.SimWorker.Tests;

public class BenchmarkTests
{
    private SimulationInputSnapshot GenerateBenchmarkSnapshot(int orderCount, int locationCount)
    {
        var locations = Enumerable.Range(0, locationCount).Select(i => new SimulationLocation(
            Id: $"loc_{i}",
            X: (i % 50) * 1.5,
            Y: Math.Floor((double)i / 50.0) * 2.5,
            Z: (i % 4) * 1.5,
            AccessType: i % 4 == 3 ? "forklift" : "manual",
            Capacity: 2,
            IsBlocked: false
        )).ToList();

        var inventory = Enumerable.Range(0, locationCount * 2).Select(i => new SimulationInventoryItem(
            MuId: $"{100000 + (i % 5000)}",
            LocationId: $"loc_{i % locationCount}",
            Sku: $"SKU_{1000 + (i % 300)}",
            QuantityUnits: 12
        )).ToList();

        var orders = Enumerable.Range(0, orderCount).Select(i => new SimulationOrder(
            OrderId: $"ORD_{i:D9}",
            ArrivalTime: i * 30,
            Deadline: i * 30 + 3600,
            Priority: i % 10 == 0 ? "HIGH" : "STANDARD",
            Items: new List<SimulationOrderItem>
            {
                new($"l_{i}_1", $"SKU_{1000 + (i % 300)}", 1),
                new($"l_{i}_2", $"SKU_{1000 + ((i + 1) % 300)}", 2)
            }
        )).ToList();

        return new SimulationInputSnapshot(
            ContractVersion: "1.0.0",
            SnapshotId: $"bench_{orderCount}",
            SnapshotHash: $"hash_{orderCount}",
            WorkspaceId: "ws_default",
            Seed: 42,
            Config: new SimulationConfig(0, 86400, "BATCH_WAVE_ROUTING"),
            Rules: new SimulationRules(),
            Locations: locations,
            Inventory: inventory,
            Workload: new SimulationWorkload(orders)
        );
    }

    [Fact]
    public void ExecutesOneThousandOrdersSubTwentyMillisecondsInNet()
    {
        var engine = new DeterministicSimulationEngine();
        var snapshot = GenerateBenchmarkSnapshot(1000, 2000);

        // Warmup
        engine.ExecuteRun(snapshot);

        var sw = Stopwatch.StartNew();
        var result = engine.ExecuteRun(snapshot);
        sw.Stop();

        Assert.Equal(1000, result.SummaryMetrics.TotalOrders);
        Assert.Equal(1000, result.SummaryMetrics.FulfilledOrders);
        Assert.True(sw.ElapsedMilliseconds < 50, $"Elapsed was {sw.ElapsedMilliseconds}ms, expected < 50ms");
    }

    [Fact]
    public void MeasuresNetLatencyDistributionP50P95()
    {
        var engine = new DeterministicSimulationEngine();
        var snapshot = GenerateBenchmarkSnapshot(500, 1000);
        var timings = new List<double>();

        // Warmup
        engine.ExecuteRun(snapshot);

        for (int i = 0; i < 20; i++)
        {
            var sw = Stopwatch.StartNew();
            engine.ExecuteRun(snapshot);
            sw.Stop();
            timings.Add(sw.Elapsed.TotalMilliseconds);
        }

        timings.Sort();
        var p50 = timings[(int)(timings.Count * 0.5)];
        var p95 = timings[(int)(timings.Count * 0.95)];

        Assert.True(p50 < 15.0, $"p50 was {p50}ms, expected < 15ms");
        Assert.True(p95 < 25.0, $"p95 was {p95}ms, expected < 25ms");
    }
}
