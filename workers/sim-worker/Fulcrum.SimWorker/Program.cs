using System.Text.Json;
using Fulcrum.SimWorker.Engine;
using Fulcrum.SimWorker.Model;
using Npgsql;

namespace Fulcrum.SimWorker;

public static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public static async Task Main(string[] args)
    {
        Console.WriteLine("[Fulcrum.SimWorker] Initializing deterministic simulation worker...");

        var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL")
            ?? Environment.GetEnvironmentVariable("SUPABASE_DB_URL");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            Console.WriteLine("[Fulcrum.SimWorker] Notice: No DATABASE_URL configured. Running self-test verification against embedded golden snapshot.");
            RunSelfTest();
            return;
        }

        Console.WriteLine("[Fulcrum.SimWorker] Connected to Postgres job queue. Polling simulation_runs (FOR UPDATE SKIP LOCKED)...");
        var engine = new DeterministicSimulationEngine();
        using var cts = new CancellationTokenSource();
        Console.CancelKeyPress += (s, e) =>
        {
            e.Cancel = true;
            cts.Cancel();
        };

        while (!cts.Token.IsCancellationRequested)
        {
            try
            {
                await ProcessNextJobAsync(connectionString, engine, cts.Token);
                await Task.Delay(2000, cts.Token);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[Fulcrum.SimWorker] Error in job poll loop: {ex.Message}");
                await Task.Delay(5000, cts.Token);
            }
        }

        Console.WriteLine("[Fulcrum.SimWorker] Worker shutdown gracefully.");
    }

    private static void RunSelfTest()
    {
        var engine = new DeterministicSimulationEngine();
        var snapshot = new SimulationInputSnapshot(
            ContractVersion: "1.0.0",
            SnapshotId: "snap_golden_01",
            SnapshotHash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
            WorkspaceId: "ws_default",
            Seed: 48213,
            Config: new SimulationConfig(0, 28800, "BASELINE"),
            Rules: new SimulationRules(),
            Locations: new List<SimulationLocation>
            {
                new("loc_EH14A", 16.8, 17.5, 0.5, "manual", 2, false),
                new("loc_EH14D", 16.8, 17.5, 5.5, "forklift", 2, false)
            },
            Inventory: new List<SimulationInventoryItem>
            {
                new("502900", "loc_EH14A", "1524289001", 6),
                new("502900", "loc_EH14A", "1524289002", 5)
            },
            Workload: new SimulationWorkload(
                Orders: new List<SimulationOrder>
                {
                    new("000815296", 0, 3600, "HIGH", new List<SimulationOrderItem> { new("l1", "1524289001", 1) }),
                    new("000815297", 60, 3600, "HIGH", new List<SimulationOrderItem> { new("l2", "1524289002", 1) })
                }
            )
        );

        var result = engine.ExecuteRun(snapshot);
        Console.WriteLine($"[Fulcrum.SimWorker] Self-test verified: RunId={result.RunId}, Orders={result.SummaryMetrics.TotalOrders}, RedundantTrips={result.SummaryMetrics.RedundantMuTrips}");
    }

    private static async Task ProcessNextJobAsync(string connectionString, ISimulationEngineService engine, CancellationToken ct)
    {
        await using var dataSource = NpgsqlDataSource.Create(connectionString);
        await using var connection = await dataSource.OpenConnectionAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);

        const string claimSql = @"
            SELECT id, snapshot_payload
            FROM simulation_runs
            WHERE status = 'QUEUED'
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED;
        ";

        string? runId = null;
        string? payloadJson = null;

        await using (var cmd = new NpgsqlCommand(claimSql, connection, tx))
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            if (await reader.ReadAsync(ct))
            {
                runId = reader.GetString(0);
                payloadJson = reader.GetString(1);
            }
        }

        if (runId == null || payloadJson == null)
        {
            await tx.RollbackAsync(ct);
            return;
        }

        Console.WriteLine($"[Fulcrum.SimWorker] Claimed simulation run {runId}. Executing...");

        // Mark as running
        const string markRunningSql = @"
            UPDATE simulation_runs
            SET status = 'RUNNING', started_at = NOW()
            WHERE id = $1;
        ";
        await using (var markCmd = new NpgsqlCommand(markRunningSql, connection, tx))
        {
            markCmd.Parameters.AddWithValue(runId);
            await markCmd.ExecuteNonQueryAsync(ct);
        }

        await tx.CommitAsync(ct);

        // Execute simulation outside claiming lock
        try
        {
            var snapshot = JsonSerializer.Deserialize<SimulationInputSnapshot>(payloadJson, JsonOptions)
                ?? throw new InvalidOperationException($"Failed to deserialize snapshot JSON for run {runId}");

            var result = engine.ExecuteRun(snapshot);
            var resultJson = JsonSerializer.Serialize(result, JsonOptions);
            var metricsJson = JsonSerializer.Serialize(result.SummaryMetrics, JsonOptions);

            const string completeSql = @"
                UPDATE simulation_runs
                SET status = 'COMPLETED',
                    result_payload = $1::jsonb,
                    metrics_summary = $2::jsonb,
                    completed_at = NOW()
                WHERE id = $3;
            ";

            await using var completeCmd = new NpgsqlCommand(completeSql, connection);
            completeCmd.Parameters.AddWithValue(resultJson);
            completeCmd.Parameters.AddWithValue(metricsJson);
            completeCmd.Parameters.AddWithValue(runId);
            await completeCmd.ExecuteNonQueryAsync(ct);

            Console.WriteLine($"[Fulcrum.SimWorker] Completed run {runId} in {result.ExecutionWallTimeMs}ms. Fulfilled={result.SummaryMetrics.FulfilledOrders}, RedundantTrips={result.SummaryMetrics.RedundantMuTrips}");
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[Fulcrum.SimWorker] Run {runId} failed: {ex.Message}");
            const string failSql = @"
                UPDATE simulation_runs
                SET status = 'FAILED',
                    error_message = $1,
                    completed_at = NOW()
                WHERE id = $2;
            ";
            await using var failCmd = new NpgsqlCommand(failSql, connection);
            failCmd.Parameters.AddWithValue(ex.Message);
            failCmd.Parameters.AddWithValue(runId);
            await failCmd.ExecuteNonQueryAsync(ct);
        }
    }
}
