'use client';

import React, { useState } from 'react';
import {
  Boxes,
  Layers,
  Activity,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  ChevronRight,
  TrendingDown,
  Clock,
  Sparkles,
  Search,
  Sliders,
  ShieldCheck
} from 'lucide-react';

import { LayoutEngine, WarehouseLayoutConfig, LocationStructured } from '@fulcrum/domain';
import { PureTypeScriptSimulationEngine } from '@fulcrum/sim-engine';
import { SimulationInputSnapshot, SimulationOutputResult } from '@fulcrum/contracts';

// Default layout A configuration
const defaultLayoutConfig: WarehouseLayoutConfig = {
  id: 'layout_default',
  version: 1,
  workspaceId: 'ws_default',
  name: 'Showcase Facility Alpha',
  prefixEnabled: true,
  sides: [{ code: 'E', label: 'E-commerce' }],
  rowType: 'alpha',
  rowStart: 'A',
  rowCount: 12,
  defaultBaysPerRow: 16,
  bayOverrides: { H: 10 },
  bayPadding: 2,
  rowPadding: 0,
  levels: [
    { code: 'A', label: 'Tier 1 Floor', accessType: 'manual', heightMeters: 0.5 },
    { code: 'B', label: 'Tier 2 Mid', accessType: 'manual', heightMeters: 2.0 },
    { code: 'C', label: 'Tier 3 Mid', accessType: 'manual', heightMeters: 3.5 },
    { code: 'D', label: 'Tier 4 High Bay', accessType: 'forklift', heightMeters: 5.5 }
  ],
  separator: '',
  defaultPlatformsPerLocation: 2,
  defaultPlatformCapacityUnits: 10,
  bayWidthMeters: 1.2,
  levelHeightMeters: 1.5,
  aisleWidthMeters: 2.5
};

export default function Dashboard() {
  const [layout] = useState<WarehouseLayoutConfig>(defaultLayoutConfig);
  const [selectedLocCode, setSelectedLocCode] = useState<string>('EH08D');
  const [simSeed, setSimSeed] = useState<number>(42);
  const [selectedStrategy, setSelectedStrategy] = useState<'BASELINE' | 'CONGESTION_AWARE'>('BASELINE');
  const [activeHeatmap, setActiveHeatmap] = useState<'occupancy' | 'congestion'>('congestion');
  const [planState, setPlanState] = useState<'Proposed' | 'Reviewed' | 'Simulated' | 'Approved' | 'Committed'>('Proposed');

  // Generate warehouse locations dynamically from domain engine
  const locations = React.useMemo(() => {
    return LayoutEngine.generateLocations(layout);
  }, [layout]);

  // Build input snapshot for simulation
  const snapshot: SimulationInputSnapshot = React.useMemo(() => {
    return {
      contract_version: '1.0.0',
      snapshot_id: 'snap_showcase_01',
      snapshot_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      workspace_id: 'ws_default',
      seed: simSeed,
      config: {
        start_time_seconds: 0,
        duration_seconds: 28800,
        strategy: selectedStrategy
      },
      rules: {
        congestion_radius_meters: 2.5,
        congestion_slowdown_factor: 0.5,
        forklift_lockout_duration_seconds: 180,
        picker_walking_speed_mps: 1.2,
        forklift_speed_mps: 2.0
      },
      locations: locations.slice(0, 100).map(l => ({
        id: l.id,
        x: l.coordinates.x,
        y: l.coordinates.y,
        z: l.coordinates.z,
        access_type: l.accessType,
        capacity: l.maxPlatforms,
        is_blocked: l.isBlocked
      })),
      inventory: [
        { mu_id: 'mu_01', location_id: locations[0]?.id || 'loc_1', sku: 'SKU-RED-S', quantity: 80 },
        { mu_id: 'mu_02', location_id: locations[3]?.id || 'loc_2', sku: 'SKU-BLUE-L', quantity: 60 },
        { mu_id: 'mu_03', location_id: locations[7]?.id || 'loc_3', sku: 'SKU-YELLOW-M', quantity: 45 },
        { mu_id: 'mu_04', location_id: locations[12]?.id || 'loc_4', sku: 'SKU-GREEN-XL', quantity: 30 }
      ],
      workload: {
        orders: Array.from({ length: 24 }).map((_, i) => ({
          order_id: `ORD-9${i + 10}`,
          arrival_time: i * 240,
          deadline: (i + 1) * 360 + 1200,
          priority: i % 4 === 0 ? 'HIGH' : 'STANDARD',
          items: [{ sku: i % 2 === 0 ? 'SKU-RED-S' : 'SKU-BLUE-L', quantity: 2 }]
        })),
        replenishment_triggers: []
      },
      resources: {
        manual_pickers: [{ id: 'pkr_01', name: 'Picker Alpha', speed_mps: 1.2 }],
        forklifts: [{ id: 'flt_01', name: 'Forklift Bravo', speed_mps: 2.0 }]
      }
    };
  }, [locations, simSeed, selectedStrategy]);

  // Execute deterministic engine simulation
  const simEngine = React.useMemo(() => new PureTypeScriptSimulationEngine(), []);
  const baselineResult = React.useMemo(() => {
    return simEngine.executeRun({ ...snapshot, config: { ...snapshot.config, strategy: 'BASELINE' } });
  }, [simEngine, snapshot]);

  const congestionAwareResult = React.useMemo(() => {
    return simEngine.executeRun({ ...snapshot, config: { ...snapshot.config, strategy: 'CONGESTION_AWARE' } });
  }, [simEngine, snapshot]);

  const activeResult = selectedStrategy === 'BASELINE' ? baselineResult : congestionAwareResult;

  const selectedLoc = locations.find(l => l.code === selectedLocCode) || locations[0];

  return (
    <div className="flex h-screen w-full bg-canvas text-slate-100 overflow-hidden font-sans">
      {/* LEFT NAVIGATION */}
      <aside className="w-64 border-r border-border-subtle bg-surface flex flex-col justify-between p-4">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="h-8 w-8 rounded bg-cyan-500/20 border border-cyan-500 flex items-center justify-center text-cyan-400 font-bold">
              F
            </div>
            <div>
              <div className="font-semibold text-sm tracking-wide text-slate-100">FULCRUM</div>
              <div className="text-[11px] text-slate-400">Optimization & Sim Lab</div>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { label: 'Overview', active: true, icon: Activity },
              { label: 'Layout Config', icon: Sliders },
              { label: 'Inventory Ledger', icon: Layers },
              { label: 'Fulfillment Queue', icon: Boxes },
              { label: 'Simulation Lab', icon: Cpu },
              { label: 'AI Governance', icon: ShieldCheck },
            ].map(item => (
              <button
                key={item.label}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition ${
                  item.active
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* WORKSPACE & ROLE */}
        <div className="p-3 bg-slate-900/60 rounded border border-border-subtle text-xs space-y-1">
          <div className="flex justify-between text-slate-400">
            <span>Workspace:</span>
            <span className="font-mono text-cyan-400">ws_default</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Role:</span>
            <span className="text-slate-200">Lead Planner</span>
          </div>
          <div className="pt-2 border-t border-slate-800 flex items-center gap-1.5 text-[11px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Deterministic Local Engine
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOP BAR */}
        <header className="h-14 border-b border-border-subtle bg-surface flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-900 border border-border-subtle px-3 py-1.5 rounded text-xs">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={selectedLocCode}
                onChange={e => setSelectedLocCode(e.target.value.toUpperCase())}
                placeholder="Search location code (e.g. EH14D)..."
                className="bg-transparent border-none outline-none text-slate-200 font-mono w-48 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-800/60 border border-border-subtle text-xs text-slate-300">
              <Clock className="h-3 w-3 text-cyan-400" />
              <span>Synced 12s ago</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2.5 py-1 rounded font-medium flex items-center gap-1">
              Synthetic Dataset
            </span>
            <button
              onClick={() => setSimSeed(prev => prev + 1)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-border-subtle"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Scenario
            </button>
            <button
              onClick={() => setSelectedStrategy(s => s === 'BASELINE' ? 'CONGESTION_AWARE' : 'BASELINE')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm"
            >
              <Play className="h-3.5 w-3.5" />
              Run Simulation ({selectedStrategy})
            </button>
          </div>
        </header>

        {/* DASHBOARD BODY */}
        <main className="flex-1 flex overflow-hidden">
          {/* CENTER PANEL: KPIs + TOP-DOWN PLAN VIEW + BOTTOM COMPARISON */}
          <div className="flex-1 flex flex-col p-5 overflow-y-auto space-y-5">
            {/* KPI STRIP */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-surface border border-border-subtle p-3.5 rounded">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider">Total Locations</div>
                <div className="text-2xl font-mono font-bold text-slate-100 mt-1">{locations.length}</div>
                <div className="text-[11px] text-slate-500 mt-1">Configured in Layout v{layout.version}</div>
              </div>
              <div className="bg-surface border border-border-subtle p-3.5 rounded">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider">Congestion Delay</div>
                <div className="text-2xl font-mono font-bold text-amber-400 mt-1">
                  {activeResult.summary_metrics.total_congestion_delay_seconds}s
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {activeResult.summary_metrics.forklift_contention_events} Contention Events
                </div>
              </div>
              <div className="bg-surface border border-border-subtle p-3.5 rounded">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider">Travel Distance</div>
                <div className="text-2xl font-mono font-bold text-cyan-400 mt-1">
                  {activeResult.summary_metrics.total_travel_distance_meters}m
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Avg Cycle: {activeResult.summary_metrics.average_order_cycle_time_seconds}s
                </div>
              </div>
              <div className="bg-surface border border-border-subtle p-3.5 rounded">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider">Order Fulfillment</div>
                <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">
                  {activeResult.summary_metrics.fulfilled_orders} / {activeResult.summary_metrics.total_orders}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Late: {activeResult.summary_metrics.late_orders} | Shortages: {activeResult.summary_metrics.stock_shortages}
                </div>
              </div>
            </div>

            {/* WAREHOUSE TOP-DOWN 2D PLAN VIEW */}
            <div className="bg-surface border border-border-subtle rounded p-4 flex flex-col flex-1">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-slate-200">Warehouse Plan View (Top-Down Aisle Map)</h3>
                  <span className="text-[11px] text-slate-400 font-mono">Layout: {layout.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveHeatmap('congestion')}
                    className={`px-2.5 py-1 text-xs rounded border ${
                      activeHeatmap === 'congestion'
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'border-border-subtle text-slate-400'
                    }`}
                  >
                    Heatmap: Congestion
                  </button>
                  <button
                    onClick={() => setActiveHeatmap('occupancy')}
                    className={`px-2.5 py-1 text-xs rounded border ${
                      activeHeatmap === 'occupancy'
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                        : 'border-border-subtle text-slate-400'
                    }`}
                  >
                    Heatmap: Occupancy
                  </button>
                </div>
              </div>

              {/* RACK GRID RENDERING */}
              <div className="flex-1 bg-slate-950/60 border border-slate-800/80 rounded p-4 overflow-auto">
                <div className="space-y-3 min-w-[700px]">
                  {Array.from({ length: layout.rowCount }).map((_, rIdx) => {
                    const rowChar = String.fromCharCode(65 + rIdx);
                    const baysCount = layout.bayOverrides?.[rowChar] ?? layout.defaultBaysPerRow;

                    return (
                      <div key={rowChar} className="flex items-center gap-2">
                        <span className="w-10 text-xs font-mono font-semibold text-slate-400 text-right">
                          Row {rowChar}
                        </span>
                        <div className="flex gap-1.5 flex-1">
                          {Array.from({ length: baysCount }).map((_, bIdx) => {
                            const bayNum = bIdx + 1;
                            const sampleCode = `E${rowChar}${String(bayNum).padStart(2, '0')}D`;
                            const isSelected = selectedLoc?.structured.row === rowChar && selectedLoc?.structured.column === bayNum;
                            const isCongested = rowChar === 'H' && bayNum >= 6 && bayNum <= 9;

                            return (
                              <button
                                key={bayNum}
                                onClick={() => setSelectedLocCode(sampleCode)}
                                title={`Bay ${rowChar}${String(bayNum).padStart(2, '0')}`}
                                className={`h-8 flex-1 rounded text-[10px] font-mono flex items-center justify-center transition border ${
                                  isSelected
                                    ? 'ring-2 ring-cyan-400 border-white text-white font-bold'
                                    : 'border-slate-800'
                                } ${
                                  isCongested
                                    ? 'bg-amber-600/30 text-amber-200 border-amber-500/50'
                                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                                }`}
                              >
                                {String(bayNum).padStart(2, '0')}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* BOTTOM COMPARISON & AI GOVERNANCE SPLIT */}
            <div className="grid grid-cols-2 gap-4">
              {/* STRATEGY COMPARISON MATRIX */}
              <div className="bg-surface border border-border-subtle p-4 rounded space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Policy Comparison Matrix (Simulated)
                  </h4>
                  <span className="text-[11px] font-mono text-cyan-400">Seed: {simSeed}</span>
                </div>

                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-slate-400 border-b border-border-subtle">
                      <th className="text-left pb-2">Metric</th>
                      <th className="text-right pb-2">Baseline</th>
                      <th className="text-right pb-2">Congestion-Aware</th>
                      <th className="text-right pb-2">Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    <tr>
                      <td className="py-2 text-slate-300">Congestion Delay</td>
                      <td className="text-right text-amber-400">{baselineResult.summary_metrics.total_congestion_delay_seconds}s</td>
                      <td className="text-right text-emerald-400">{congestionAwareResult.summary_metrics.total_congestion_delay_seconds}s</td>
                      <td className="text-right text-emerald-400">
                        -{baselineResult.summary_metrics.total_congestion_delay_seconds - congestionAwareResult.summary_metrics.total_congestion_delay_seconds}s
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-300">Late Orders</td>
                      <td className="text-right text-slate-300">{baselineResult.summary_metrics.late_orders}</td>
                      <td className="text-right text-emerald-400">{congestionAwareResult.summary_metrics.late_orders}</td>
                      <td className="text-right text-slate-400">0</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-300">Avg Cycle Time</td>
                      <td className="text-right text-slate-300">{baselineResult.summary_metrics.average_order_cycle_time_seconds}s</td>
                      <td className="text-right text-emerald-400">{congestionAwareResult.summary_metrics.average_order_cycle_time_seconds}s</td>
                      <td className="text-right text-emerald-400">
                        -{(baselineResult.summary_metrics.average_order_cycle_time_seconds - congestionAwareResult.summary_metrics.average_order_cycle_time_seconds).toFixed(1)}s
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* AI GOVERNANCE & PROPOSED PLAN LIFECYCLE */}
              <div className="bg-surface border border-purple-900/40 bg-purple-950/10 p-4 rounded space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    AI Optimization Recommendation
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-900/40 text-purple-200 border border-purple-700/50">
                    Status: {planState}
                  </span>
                </div>

                <div className="text-xs text-slate-300 leading-relaxed">
                  <span className="font-semibold text-slate-100">Observation:</span> Heavy contention detected in Row H (Bays 06-09) due to simultaneous Tier-4 forklift replenishment and manual batch picks.
                </div>

                <div className="text-xs text-slate-300 space-y-1">
                  <span className="font-semibold text-slate-100">Verifiable Evidence:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedLocCode('EH08D')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-border-subtle font-mono text-[11px] text-cyan-400"
                    >
                      Loc EH08D
                    </button>
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-border-subtle font-mono text-[11px] text-slate-300">
                      Run #{activeResult.run_id.slice(-6)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-purple-900/30 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400">
                    Plan Action: Reschedule Forklift Pallet Insertions
                  </div>
                  <div className="flex gap-2">
                    {planState === 'Proposed' && (
                      <button
                        onClick={() => setPlanState('Reviewed')}
                        className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-border-subtle"
                      >
                        Review Plan
                      </button>
                    )}
                    {planState === 'Reviewed' && (
                      <button
                        onClick={() => {
                          setSelectedStrategy('CONGESTION_AWARE');
                          setPlanState('Simulated');
                        }}
                        className="px-2.5 py-1 text-xs rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
                      >
                        Simulate Plan
                      </button>
                    )}
                    {planState === 'Simulated' && (
                      <button
                        onClick={() => setPlanState('Approved')}
                        className="px-2.5 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                      >
                        Approve Plan
                      </button>
                    )}
                    {planState === 'Approved' && (
                      <button
                        onClick={() => setPlanState('Committed')}
                        className="px-2.5 py-1 text-xs rounded bg-purple-600 hover:bg-purple-500 text-white font-medium"
                      >
                        Commit to Ledger
                      </button>
                    )}
                    {planState === 'Committed' && (
                      <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Committed to Ledger
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT DRAWER: RACK ELEVATION DRILL-DOWN */}
          <aside className="w-80 border-l border-border-subtle bg-surface p-4 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider">Selected Bay Elevation</div>
                <div className="text-lg font-mono font-bold text-cyan-400 mt-0.5">{selectedLoc?.code}</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                {selectedLoc?.accessType.toUpperCase()}
              </span>
            </div>

            {/* VERTICAL RACK ELEVATION TIERS */}
            <div className="space-y-3 flex-1 overflow-y-auto">
              {layout.levels.slice().reverse().map(lvl => {
                const isCurrentLevel = selectedLoc?.structured.level === lvl.code;
                const isForklift = lvl.accessType === 'forklift';

                return (
                  <div
                    key={lvl.code}
                    className={`p-3 rounded border transition ${
                      isCurrentLevel
                        ? 'border-cyan-500 bg-cyan-950/20'
                        : 'border-border-subtle bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-slate-200">Level {lvl.code}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          isForklift
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {lvl.accessType}
                      </span>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-400">
                      Elevation: {lvl.heightMeters}m | Max Platforms: {layout.defaultPlatformsPerLocation}
                    </div>

                    {/* PLATFORM SLOTS */}
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="p-2 bg-slate-950/80 rounded border border-slate-800 text-[10px]">
                        <div className="text-slate-400">Platform 1</div>
                        <div className="font-mono text-cyan-300 mt-0.5">MU-8021</div>
                        <div className="text-slate-500">24 / 30 Units</div>
                      </div>
                      <div className="p-2 bg-slate-950/80 rounded border border-slate-800 text-[10px]">
                        <div className="text-slate-400">Platform 2</div>
                        <div className="font-mono text-slate-500 mt-0.5">Empty Slot</div>
                        <div className="text-slate-500">0 / 30 Units</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
