'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Boxes,
  Layers,
  Activity,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  TrendingDown,
  Clock,
  Sparkles,
  Search,
  Bell,
  X,
  Copy,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

import { LayoutEngine, WarehouseLayoutConfig, LocationStructured } from '@fulcrum/domain';
import { PureTypeScriptSimulationEngine } from '@fulcrum/sim-engine';
import { SimulationInputSnapshot } from '@fulcrum/contracts';

/* ============================================================
   1. WAREHOUSE CONFIG
   ============================================================ */
const CONFIG = {
  warehouse: { id: "WH-01", name: "Global Fulfillment" },
  side: { code: "E", name: "E-commerce" },
  rows: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(r => ({
    id: r,
    bays: r === "H" ? 14 : r === "Q" ? 18 : r === "W" ? 16 : 20
  })),
  levels: [
    { id: "A", label: "Bottom", access: "manual" as const, heightM: 0.5 },
    { id: "B", label: "Mid", access: "manual" as const, heightM: 2.0 },
    { id: "C", label: "Top (manual)", access: "manual" as const, heightM: 3.5 },
    { id: "D", label: "Forklift only", access: "forklift" as const, heightM: 5.5 }
  ],
  aislesAfter: [10, 16],
  voids: ["EJ08", "ER12", "EC15"],
  bayWidthM: 1.2,
  platformsPerLocation: 2
};

const DATA = {
  clock: "Tue 14 Oct · 13:05",
  syncedSec: 42,
  kpis: [
    { id: "pending", label: "Pending orders", value: "1,842", unit: "orders", delta: "+12%", dir: "up", cls: "" },
    { id: "risk", label: "Orders at risk", value: "78", unit: "orders", delta: "-4%", dir: "up", cls: "text-warn" },
    { id: "short", label: "Inventory shortages", value: "14", unit: "SKUs", delta: "+2", dir: "warn", cls: "text-warn" },
    {
      id: "through",
      label: "Fulfillment throughput",
      value: "340",
      unit: "orders/h",
      delta: "+5%",
      dir: "up",
      cls: "",
      spark: [290, 305, 298, 312, 318, 309, 325, 331, 322, 336, 340, 340],
      sparkLabel: "last 12 h"
    }
  ],
  sim: {
    runId: "SIM-2041",
    seed: 48213,
    horizonH: 8,
    completed: "Completed 2 min ago",
    proposal: "Proposal 4a (Batch MU Wave)",
    metrics: [
      { name: "Picking distance", unit: "m", base: "4,120", prop: "2,740", delta: "-33.5%" },
      { name: "Redundant MU trips", unit: "trips", base: "42", prop: "0", delta: "-42 trips" },
      { name: "Platform draw-outs (Lvl A)", unit: "draws", base: "68", prop: "24", delta: "-44 draws" },
      { name: "Cage shuffles", unit: "moves", base: "19", prop: "5", delta: "-14 moves" },
      { name: "Expected completion", unit: "", base: "15:30", prop: "14:15", delta: "-75 min" },
      { name: "Late orders", unit: "orders", base: "18", prop: "2", delta: "-16" },
      { name: "Workload balance", unit: "index 0–1", base: "0.71", prop: "0.89", delta: "+0.18" }
    ]
  },
  queue: {
    shown: 6,
    total: 1842,
    rows: [
      { prio: 1, id: "000815296", time: "22 min", state: "Picking", source: "WH-01 stock", locs: ["EC07A", "EH14D"], itemsCount: "1 line · 1 unit (1524289001 S)", mu: "MU-39102" },
      { prio: 1, id: "000815297", time: "22 min", state: "Picking", source: "WH-01 stock", locs: ["EC07A", "EH14D"], itemsCount: "1 line · 1 unit (1524289002 M)", mu: "MU-39102" },
      { prio: 2, id: "000815298", time: "23 min", state: "Waiting stock", source: "Transfer MKT-02 · ETA 14:10", locs: ["EH14D"], itemsCount: "4 lines · 6 units", mu: "MU-39103" },
      { prio: 2, id: "000815299", time: "31 min", state: "Picking", source: "WH-01 stock", locs: ["EH14B"], itemsCount: "1 line · 2 units (1524289003 L)", mu: "MU-39102" },
      { prio: 3, id: "000815300", time: "48 min", state: "Allocated", source: "Production line P2", locs: ["EK03A"], itemsCount: "12 lines · 14 units", mu: "MU-38140" },
      { prio: 3, id: "000815301", time: "1 h 12 min", state: "Queued", source: "WH-01 stock", locs: ["EM09B"], itemsCount: "1 line · 1 unit", mu: "MU-38290" }
    ]
  },
  ai: {
    observation: "Redundant trip alert: Orders 000815296 and 000815297 both request single units from parent SKU 1524289 stored in MU-39102 (Bay EH14, Platform 1). Under discrete picking, the picker walks to EH14, draws Level A cage, walks to pack station, then immediately walks back to EH14 to draw the same cage for 000815297.",
    evidence: ["EH14D", "EH14A", "MU-39102", "000815296", "000815297", "1524289001", "1524289002", "SIM-2041"],
    plan: "Batch-wave orders 000815296, 000815297, and 000815299 into a single MU visit at EH14 (saves 2 cage draw-outs, 180m travel, 8.4 min).",
    affectedOrders: 3
  },
  locations: {
    "EH14D": {
      status: "Congested",
      platforms: [
        { name: "Platform 1 (Level A Ground Pull-out)", mu: "MU-39102", boxes: 9, layers: "3 layers of 3", sku: "1524289001", skuName: "Athletic Tee Slim — Black / S", parentSku: "1524289", qty: 24, lot: "A92", status: "Active" },
        { name: "Platform 2 (Inner Cage)", mu: "MU-39103", boxes: 6, layers: "2 layers of 3", sku: "1524289002", skuName: "Athletic Tee Slim — Black / M", parentSku: "1524289", qty: 18, lot: "B17", status: "Reserved" }
      ]
    }
  } as Record<string, any>,
  mapStatus: {
    hotspot: ["EC07"],
    constrained: ["EH12", "EH13", "EH14", "EH15"],
    blocked: ["EI04"]
  },
  skuPool: [
    { sku: "1524289001", name: "Athletic Tee Slim — Black / S", parent: "1524289" },
    { sku: "1524289002", name: "Athletic Tee Slim — Black / M", parent: "1524289" },
    { sku: "1524289003", name: "Athletic Tee Slim — Black / L", parent: "1524289" },
    { sku: "1524289004", name: "Athletic Tee Slim — Black / XL", parent: "1524289" },
    { sku: "2841920001", name: "Cargo Trouser Utility — Navy / 30", parent: "2841920" }
  ],
  staleZone: { row: "M", text: "Zone EM — last sync 14 min ago" }
};

/* Deterministic string hash in [0, 1) */
function hash01(str: string): number {
  let h = 2166136261;
  for (const ch of String(str)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
function bayCode(rowId: string, bay: number) { return CONFIG.side.code + rowId + pad2(bay); }
function locCode(rowId: string, bay: number, level: string) { return bayCode(rowId, bay) + level; }

function parseLoc(code: string) {
  if (!code) return null;
  const m = /^([A-Z])([A-Z])(\d{2})([A-D])?$/.exec(code);
  if (!m || m[1] !== CONFIG.side.code) return null;
  const row = CONFIG.rows.find(r => r.id === m[2]);
  const bay = parseInt(m[3], 10);
  if (!row || bay < 1 || bay > row.bays) return null;
  if (m[4] && !CONFIG.levels.some(l => l.id === m[4])) return null;
  if (!m[4] && CONFIG.voids.includes(bayCode(m[2], bay))) return null;
  return { row: m[2], bay, level: m[4] || null };
}

function bayOf(code: string) {
  const p = parseLoc(code);
  return p ? bayCode(p.row, p.bay) : null;
}

function locFacts(code: string) {
  const p = parseLoc(code);
  if (!p) return { occ: 50, platforms: 2, access: 'manual' as const, levelDef: CONFIG.levels[0] };
  const h1 = hash01(code + "/occ"), h2 = hash01(code + "/plt");
  const levelDef = CONFIG.levels.find(l => l.id === p.level) || CONFIG.levels[0];
  const platforms = 1 + Math.floor(h2 * CONFIG.platformsPerLocation);
  const occ = Math.round(20 + h1 * 78);
  return { occ, platforms, access: levelDef.access, levelDef };
}

function statusOf(code: string) {
  const b = bayOf(code) || code;
  if (DATA.mapStatus.blocked.includes(b)) return { key: "blocked", label: "Blocked", cls: "crit" };
  if (DATA.mapStatus.constrained.includes(b)) return { key: "constrained", label: "Congested", cls: "warn" };
  if (DATA.mapStatus.hotspot.includes(b)) return { key: "hotspot", label: "High activity", cls: "live" };
  return { key: "normal", label: "Normal", cls: "live" };
}

function platformsOf(code: string) {
  const cur = DATA.locations[code];
  if (cur) return cur.platforms;
  const facts = locFacts(code);
  const out = [];
  for (let i = 0; i < facts.platforms; i++) {
    const h = hash01(code + "/p" + i);
    const sku = DATA.skuPool[Math.floor(h * DATA.skuPool.length)];
    const boxes = 6 + Math.floor(h * 4);
    const layers = Math.ceil(boxes / 3);
    out.push({
      name: "Platform " + (i + 1),
      mu: "MU-" + (38000 + Math.floor(h * 1800)),
      boxes,
      layers: layers + " layers of 3",
      sku: sku.sku,
      skuName: sku.name,
      qty: boxes * 24,
      lot: String.fromCharCode(65 + Math.floor(h * 6)) + pad2(1 + Math.floor(h * 98)),
      status: h > 0.5 ? "Active" : "Reserved"
    });
  }
  return out;
}

const RAMPS = {
  teal: ["#152238", "#13304A", "#0F4A54", "#0E6B62", "#2DD4BF"],
  amber: ["#1A2233", "#2E2A16", "#4A3A12", "#8A6410", "#FBBF24"]
};
function rampColor(ramp: 'teal' | 'amber', v: number) {
  return RAMPS[ramp][Math.min(4, Math.floor(v * 5))];
}

const MODES = [
  { id: "density", label: "Inventory density" },
  { id: "activity", label: "Picking activity" },
  { id: "bottleneck", label: "Bottlenecks" },
  { id: "blocked", label: "Blocked / constrained" },
  { id: "access", label: "Access level" }
];

export default function OperationalOverviewPage() {
  const [selectedLoc, setSelectedLoc] = useState<string>("EH14D");
  const [drawerOpen, setDrawerOpen] = useState<boolean>(true);
  const [mode, setMode] = useState<string>("density");
  const [searchVal, setSearchVal] = useState<string>("");
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [highlightedOrder, setHighlightedOrder] = useState<string | null>(null);
  const [simRun, setSimRun] = useState<number>(0);
  const [simBusy, setSimBusy] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalApproved, setModalApproved] = useState<boolean>(false);
  const [reviewChecked, setReviewChecked] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [openPlatforms, setOpenPlatforms] = useState<Record<number, boolean>>({ 0: true });
  const [feedErrorDismissed, setFeedErrorDismissed] = useState<boolean>(false);

  // SVG Geometry
  const GEOM = { labelW: 34, headH: 18, cellW: 33, cellH: 12, rowGap: 3, aisle: 14 };
  const bayX = (bay: number) => {
    let x = GEOM.labelW + (bay - 1) * GEOM.cellW;
    for (const a of CONFIG.aislesAfter) if (bay > a) x += GEOM.aisle;
    return x;
  };
  const maxBays = Math.max(...CONFIG.rows.map(r => r.bays));
  const mapWidth = bayX(maxBays) + GEOM.cellW + 6;
  const mapHeight = GEOM.headH + CONFIG.rows.length * (GEOM.cellH + GEOM.rowGap) + 4;

  const selectLocation = (code: string) => {
    const p = parseLoc(code);
    if (!p) return;
    if (!p.level) {
      let best = CONFIG.levels[0].id, bestOcc = -1;
      for (const l of CONFIG.levels) {
        const f = locFacts(locCode(p.row, p.bay, l.id));
        if (f.occ > bestOcc) { bestOcc = f.occ; best = l.id; }
      }
      p.level = best;
    }
    const fullCode = locCode(p.row, p.bay, p.level);
    setSelectedLoc(fullCode);
    setDrawerOpen(true);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#loc=${fullCode}`);
    }
  };

  const bayHeat = (bc: string) => {
    switch (mode) {
      case "density": return { fill: rampColor("teal", hash01(bc + "/d")) };
      case "activity": {
        const hot = DATA.mapStatus.hotspot.includes(bc);
        const v = hot ? 0.97 : hash01(bc + "/a") * 0.8;
        return { fill: rampColor("teal", v), hot };
      }
      case "bottleneck": {
        const c = DATA.mapStatus.constrained.includes(bc);
        const v = c ? 0.75 + hash01(bc + "/b") * 0.25 : hash01(bc + "/b") * 0.55;
        return { fill: rampColor("amber", v), constrained: c };
      }
      case "blocked": {
        if (DATA.mapStatus.blocked.includes(bc)) return { fill: "rgba(248,113,113,.28)", blocked: true };
        if (DATA.mapStatus.constrained.includes(bc)) return { fill: "rgba(251,191,36,.22)", constrained: true };
        return { fill: "#141E30" };
      }
      case "access": {
        const forklift = hash01(bc + "/x") > 0.45;
        return { fill: forklift ? "#232B45" : "#10333C", forklift };
      }
      default: return { fill: "#141E30" };
    }
  };

  const handleSimulate = () => {
    if (simBusy) return;
    setSimBusy(true);
    setTimeout(() => {
      setSimRun(1);
      setSimBusy(false);
    }, 1400);
  };

  const handleCopy = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(selectedLoc);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const q = searchVal.trim().toUpperCase();
    if (parseLoc(q)) {
      setSearchErr(null);
      selectLocation(q);
      (e.target as HTMLInputElement).blur();
    } else {
      setSearchErr(`No location matches "${q}" — codes look like EH14D (side, row, bay 01–20, level A–D).`);
      setTimeout(() => setSearchErr(null), 3000);
    }
  };

  const parsedSelected = parseLoc(selectedLoc);
  const currentStatus = statusOf(selectedLoc);
  const currentFacts = locFacts(selectedLoc);
  const selectedBayCode = bayOf(selectedLoc);

  return (
    <div className="w-[1440px] h-[1000px] overflow-hidden bg-bg-0 text-text-1 grid grid-cols-[200px_minmax(0,1fr)] select-none">
      {/* ==================== 1. SIDEBAR ==================== */}
      <aside className="bg-surface border-r border-border flex flex-col p-3 pt-2">
        <div className="flex items-center gap-2 p-2 pb-4 text-[13px] font-semibold tracking-wide">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M3 15V3h2.4v9.6H15V15H3z" fill="#2DD4BF" />
            <path d="M9 3h6v2.4H9z" fill="#2DD4BF" opacity=".55" />
          </svg>
          Fulcrum
        </div>

        <nav className="flex flex-col gap-0.5">
          <button className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-live bg-live-dim font-medium text-left">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="1" stroke="currentColor" />
              <rect x="8" y="1.5" width="4.5" height="4.5" rx="1" stroke="currentColor" />
              <rect x="1.5" y="8" width="4.5" height="4.5" rx="1" stroke="currentColor" />
              <rect x="8" y="8" width="4.5" height="4.5" rx="1" stroke="currentColor" />
            </svg>
            Overview
          </button>
          <button className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-text-2 hover:bg-surface-2 hover:text-text-1 text-left">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 3.5h10M2 7h10M2 10.5h6" stroke="currentColor" strokeLinecap="round" />
            </svg>
            Orders
            <span className="ml-auto font-mono text-[10px] text-warn bg-warn-dim border border-warn/30 rounded px-1.5 py-0.5">1,842</span>
          </button>
          <button className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-text-2 hover:bg-surface-2 hover:text-text-1 text-left">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5l5.5 3v5L7 12.5 1.5 9.5v-5L7 1.5z" stroke="currentColor" strokeLinejoin="round" />
              <path d="M7 7v5.5M1.5 4.5L7 7l5.5-2.5" stroke="currentColor" />
            </svg>
            Inventory
            <span className="ml-auto font-mono text-[10px] text-warn bg-warn-dim border border-warn/30 rounded px-1.5 py-0.5">14</span>
          </button>
          <button className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-text-2 hover:bg-surface-2 hover:text-text-1 text-left">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1.5 11.5h11M3 11.5V7M7 11.5V3.5M11 11.5V5.5" stroke="currentColor" strokeLinecap="round" />
            </svg>
            Fulfillment
          </button>
          <button className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-text-2 hover:bg-surface-2 hover:text-text-1 text-left">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M4 1.5h6v3l2.5 6a1.8 1.8 0 01-1.7 2.5H3.2a1.8 1.8 0 01-1.7-2.5l2.5-6v-3z" stroke="currentColor" strokeLinejoin="round" />
              <path d="M3.5 9.5h7" stroke="currentColor" />
            </svg>
            Simulation Lab
          </button>
          <button className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-text-2 hover:bg-surface-2 hover:text-text-1 text-left">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" />
              <path d="M7 4v3l2 1.5" stroke="currentColor" strokeLinecap="round" />
            </svg>
            Optimization
          </button>
          <button className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-text-2 hover:bg-surface-2 hover:text-text-1 text-left">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 12V8M5.5 12V5M9 12V7M12.5 12V2.5" stroke="currentColor" strokeLinecap="round" />
            </svg>
            Analytics
          </button>
          <button className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-text-2 hover:bg-surface-2 hover:text-text-1 text-left">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <ellipse cx="7" cy="3.2" rx="5" ry="1.9" stroke="currentColor" />
              <path d="M2 3.2v7.6c0 1 2.2 1.9 5 1.9s5-.9 5-1.9V3.2M2 7c0 1 2.2 1.9 5 1.9s5-.9 5-1.9" stroke="currentColor" />
            </svg>
            Data Sources
          </button>
          <button className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-text-2 hover:bg-surface-2 hover:text-text-1 text-left">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="1.8" stroke="currentColor" />
              <path d="M7 1.5v1.6M7 10.9v1.6M1.5 7h1.6M10.9 7h1.6M3.1 3.1l1.1 1.1M9.8 9.8l1.1 1.1M10.9 3.1L9.8 4.2M4.2 9.8L3.1 10.9" stroke="currentColor" strokeLinecap="round" />
            </svg>
            Settings
          </button>
        </nav>

        <div className="mt-auto p-2 border-t border-border text-text-3 text-[10px] leading-relaxed">
          Fulcrum OS · build 4.2.1<br />EU-Central region
        </div>
      </aside>

      {/* ==================== 2. MAIN GRID ==================== */}
      <main className="grid grid-rows-[48px_92px_26px_minmax(0,1fr)_320px_26px] gap-2 p-2 px-3 min-w-0 h-[1000px]">
        {/* TOP BAR */}
        <header className="flex items-center gap-3 bg-surface border border-border rounded-md px-3">
          <button className="flex items-center gap-2 py-1 px-2 border border-border rounded text-xs font-semibold hover:border-border-strong">
            Global Fulfillment <span className="mono font-normal text-text-2">WH-01</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2.5 4L5 6.5 7.5 4" stroke="currentColor" strokeLinecap="round" />
            </svg>
          </button>

          <span className="flex items-center gap-1.5 text-text-2 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-live live-pulse flex-none" />
            Synced {DATA.syncedSec} s ago
          </span>

          <span className="mono text-text-2 text-[11px]">{DATA.clock}</span>

          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-text-3 pointer-events-none" />
            <input
              type="text"
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              onKeyDown={handleSearch}
              spellCheck={false}
              autoComplete="off"
              placeholder="Search location, SKU, order, MU... e.g. EH14D"
              className={`w-[320px] h-[30px] bg-bg-1 border rounded text-text-1 mono text-[11px] pl-8 pr-3 outline-none transition ${
                searchErr ? 'border-crit' : 'border-border focus:border-live'
              }`}
            />
            {searchErr && (
              <div className="absolute top-[34px] left-0 right-0 bg-surface-3 border border-crit rounded p-1.5 text-[11px] text-crit z-30">
                {searchErr}
              </div>
            )}
          </div>

          <button className="relative flex items-center justify-center w-[30px] h-[30px] rounded text-text-2 hover:bg-surface-2 hover:text-text-1">
            <Bell className="h-4 w-4" />
            <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] rounded-full bg-crit text-white text-[9px] font-bold flex items-center justify-center px-0.5">
              3
            </span>
          </button>

          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <span className="w-[26px] h-[26px] rounded-full bg-surface-3 border border-border-strong flex items-center justify-center text-[10px] font-bold text-live">
              L
            </span>
            <span className="leading-tight">
              <span className="text-[11px] font-semibold text-text-1">Lawson</span>
              <br />
              <span className="text-[10px] text-text-3">Warehouse Manager</span>
            </span>
          </div>
        </header>

        {/* KPI STRIP */}
        <section className="grid grid-cols-5 gap-2">
          {DATA.kpis.map(k => (
            <div key={k.id} className={`bg-surface border border-border rounded-md px-3 py-2 flex flex-col justify-center gap-0.5 min-w-0 ${k.cls}`}>
              <span className="text-[10px] uppercase tracking-wider text-text-3 flex items-center gap-1.5 font-medium">
                {k.label}
              </span>
              <span className="text-[20px] font-semibold mono flex items-baseline gap-1.5 whitespace-nowrap">
                {k.value}
                <span className="text-[11px] font-normal text-text-2 font-ui">{k.unit}</span>
              </span>
              <span className="text-[11px] mono flex items-center gap-1.5 text-text-3">
                <span className={k.dir === 'up' ? 'text-live' : k.dir === 'warn' ? 'text-warn' : 'text-crit'}>
                  {k.delta}
                </span>
                {k.spark ? <span className="text-[10px] text-text-3">{k.sparkLabel}</span> : <span>vs. prev. period</span>}
              </span>
              {k.spark && (
                <svg className="mt-0.5" width="120" height="18" viewBox="0 0 120 18">
                  <polyline
                    points={k.spark.map((v, i) => `${(i / (k.spark.length - 1)) * 120},${18 - 2 - ((v - 290) / 50) * 14}`).join(' ')}
                    fill="none"
                    stroke="#2DD4BF"
                    strokeWidth="1.2"
                  />
                </svg>
              )}
            </div>
          ))}

          {/* SIMULATION STATUS KPI */}
          <div className="bg-surface border border-border rounded-md px-3 py-2 flex flex-col justify-center gap-0.5 min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-text-3 font-medium">Simulation status</span>
            <span className="text-[13px] font-semibold mono flex items-baseline gap-1.5">
              <span>{simRun === 1 ? 'SIM-2042' : DATA.sim.runId}</span>
              <span className="text-[11px] font-normal text-text-2 font-ui">
                {simRun === 1 ? 'Completed just now' : DATA.sim.completed}
              </span>
            </span>
            <span className="text-[10px] mono flex items-center gap-1.5 text-text-2">
              <span className="border border-dashed border-border-strong rounded px-1 text-[10px]">Simulated</span>
              <span>seed {simRun === 1 ? 50617 : DATA.sim.seed} · {DATA.sim.horizonH} h</span>
            </span>
          </div>
        </section>

        {/* SLIM WARNING BANNER */}
        <div className="flex items-center gap-2 bg-warn-dim border border-warn/35 border-l-[3px] border-l-warn rounded px-3 text-[11px] text-warn overflow-hidden whitespace-nowrap">
          <AlertTriangle className="h-3.5 w-3.5 flex-none" />
          <span><b>14 SKUs</b> below safety stock in zone E — replenishment review due before 14:00.</span>
          <a href="#" onClick={e => e.preventDefault()} className="font-semibold underline underline-offset-2 ml-1 text-warn">
            Open inventory exceptions
          </a>
        </div>

        {/* CONTENT: MAP PANEL + DRAWER */}
        <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-2 min-h-0">
          {/* WAREHOUSE MAP PANEL */}
          <section className="bg-surface border border-border rounded-md flex flex-col min-w-0 min-h-0 overflow-hidden">
            <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border min-h-[34px] flex-none">
              <nav className="flex items-center gap-1.5 text-[11px] text-text-3 whitespace-nowrap">
                <span className="mono text-text-2">{CONFIG.warehouse.id}</span>
                <span className="text-text-3">›</span>
                {parsedSelected ? (
                  <>
                    <span>{CONFIG.side.name}</span>
                    <span className="text-text-3">›</span>
                    <span>Row {parsedSelected.row}</span>
                    <span className="text-text-3">›</span>
                    <b className="text-text-1 font-semibold">Bay {pad2(parsedSelected.bay)}</b>
                  </>
                ) : (
                  <>
                    <b className="text-text-1 font-semibold">{CONFIG.side.name}</b>
                    <span className="text-text-3">›</span>
                    <span>No bay selected</span>
                  </>
                )}
              </nav>

              <span className="text-[10px] text-text-3 border border-border rounded px-1 flex-none">Layout v3</span>

              {/* MODE SWITCHER */}
              <div className="flex border border-border rounded overflow-hidden ml-auto flex-none">
                {MODES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`px-2 py-1 text-[10px] border-r border-border last:border-r-0 transition ${
                      mode === m.id ? 'bg-surface-3 text-live font-medium' : 'text-text-2 hover:bg-surface-2 hover:text-text-1'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* MAP BODY */}
            <div className="flex-1 relative min-h-0 p-2 px-3 pt-1">
              <svg id="mapSvg" viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="w-full h-full block" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <pattern id="patBlocked" width="6" height="6" patternUnits="userSpaceOnUse">
                    <path d="M0 6L6 0" stroke="#F87171" strokeWidth="1.1" opacity=".85" />
                  </pattern>
                  <pattern id="patConstrained" width="6" height="6" patternUnits="userSpaceOnUse">
                    <circle cx="3" cy="3" r="1" fill="#FBBF24" opacity=".9" />
                  </pattern>
                  <pattern id="patHotspot" width="6" height="6" patternUnits="userSpaceOnUse">
                    <circle cx="3" cy="3" r="1.4" fill="none" stroke="#5EEAD4" strokeWidth=".8" opacity=".9" />
                  </pattern>
                </defs>

                {/* Bay numbers top ruler */}
                {Array.from({ length: maxBays }).map((_, i) => (
                  <text
                    key={i}
                    x={bayX(i + 1) + GEOM.cellW / 2}
                    y="11"
                    textAnchor="middle"
                    fontSize="8"
                    fill="var(--text-3)"
                    fontFamily="var(--font-mono)"
                  >
                    {pad2(i + 1)}
                  </text>
                ))}

                {/* Racks per row */}
                {CONFIG.rows.map((r, ri) => {
                  const y = GEOM.headH + ri * (GEOM.cellH + GEOM.rowGap);
                  return (
                    <g key={r.id}>
                      <text
                        x={GEOM.labelW - 6}
                        y={y + GEOM.cellH - 3}
                        textAnchor="end"
                        fontSize="8.5"
                        fill="var(--text-2)"
                        fontFamily="var(--font-mono)"
                      >
                        {CONFIG.side.code + r.id}
                      </text>

                      {Array.from({ length: r.bays }).map((_, bi) => {
                        const bayNum = bi + 1;
                        const bc = bayCode(r.id, bayNum);
                        if (CONFIG.voids.includes(bc)) return null;

                        const heat = bayHeat(bc);
                        const isSelected = selectedBayCode === bc && drawerOpen;

                        return (
                          <g
                            key={bc}
                            onClick={() => selectLocation(bc)}
                            className="cursor-pointer group"
                            role="gridcell"
                            aria-label={`Bay ${bc}`}
                          >
                            <rect
                              x={bayX(bayNum)}
                              y={y}
                              width={GEOM.cellW - 2}
                              height={GEOM.cellH}
                              rx="2"
                              fill={heat.fill}
                              stroke="var(--border)"
                              strokeWidth="0.5"
                              className="group-hover:stroke-text-2"
                            />
                            {heat.blocked && (
                              <rect x={bayX(bayNum)} y={y} width={GEOM.cellW - 2} height={GEOM.cellH} rx="2" fill="url(#patBlocked)" />
                            )}
                            {heat.constrained && (
                              <rect x={bayX(bayNum)} y={y} width={GEOM.cellW - 2} height={GEOM.cellH} rx="2" fill="url(#patConstrained)" />
                            )}
                            {heat.hot && (
                              <rect x={bayX(bayNum)} y={y} width={GEOM.cellW - 2} height={GEOM.cellH} rx="2" fill="url(#patHotspot)" />
                            )}
                            {isSelected && (
                              <rect
                                x={bayX(bayNum) - 1}
                                y={y - 1}
                                width={GEOM.cellW}
                                height={GEOM.cellH + 2}
                                rx="3"
                                fill="none"
                                stroke="#FFFFFF"
                                strokeWidth="1.6"
                              />
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </svg>

              {/* Stale Badge on Zone M */}
              <div
                className="absolute flex items-center gap-1.5 bg-bg-1/95 border border-warn/45 rounded px-2 py-0.5 text-[10px] text-warn pointer-events-none"
                style={{
                  left: `calc(${(bayX(12) / mapWidth) * 100}% + 12px)`,
                  top: `calc(${((GEOM.headH + 12 * (GEOM.cellH + GEOM.rowGap) - 4) / mapHeight) * 100}% + 8px)`
                }}
              >
                <Clock className="h-3 w-3" />
                <span>{DATA.staleZone.text}</span>
              </div>
            </div>

            {/* MAP LEGEND */}
            <div className="flex items-center gap-3 px-3 py-1 border-t border-border text-[10px] text-text-3 flex-none flex-wrap">
              {mode === 'density' && (
                <>
                  <span>Inventory density:</span>
                  <span>low</span>
                  {RAMPS.teal.map(c => (
                    <span key={c} className="inline-block w-2.5 h-2.5 rounded-sm border border-border-strong -mb-0.5" style={{ background: c }} />
                  ))}
                  <span>high</span>
                </>
              )}
              {mode === 'activity' && (
                <>
                  <span>Picks/h:</span>
                  <span>0</span>
                  {RAMPS.teal.map(c => (
                    <span key={c} className="inline-block w-2.5 h-2.5 rounded-sm border border-border-strong -mb-0.5" style={{ background: c }} />
                  ))}
                  <span>40+</span>
                </>
              )}
              {mode === 'bottleneck' && (
                <>
                  <span>Queue wait:</span>
                  <span>0 min</span>
                  {RAMPS.amber.map(c => (
                    <span key={c} className="inline-block w-2.5 h-2.5 rounded-sm border border-border-strong -mb-0.5" style={{ background: c }} />
                  ))}
                  <span>15+ min</span>
                </>
              )}
              {mode === 'blocked' && (
                <>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-crit-dim border border-crit/40" /> Blocked
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-warn-dim border border-warn/40" /> Constrained
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-surface-2 border border-border" /> Clear
                  </span>
                </>
              )}
              {mode === 'access' && (
                <>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#10333C] border border-border" /> Manual pick (A–C)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#232B45] border border-border" /> Forklift-dominant (D)
                  </span>
                </>
              )}
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm border border-border-strong" style={{ background: 'repeating-linear-gradient(45deg,transparent 0 2px,#F87171 2px 3px)' }} />
                Blocked hatch
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm border border-border-strong" style={{ background: 'radial-gradient(circle at 50% 50%,#FBBF24 1.5px,transparent 1.6px)' }} />
                Constrained dots
              </span>
              <span className="ml-auto mono">Bay width {CONFIG.bayWidthM.toFixed(1)} m · levels A–D · aisle 3.0 m</span>
            </div>
          </section>

          {/* SELECTED LOCATION DRAWER */}
          <aside className="bg-surface border border-border rounded-md flex flex-col min-h-0 overflow-hidden">
            {drawerOpen && parsedSelected ? (
              <div className="flex flex-col min-h-0 flex-1">
                {/* DRAWER HEAD */}
                <div className="p-3 border-b border-border flex-none">
                  <div className="flex items-center gap-2">
                    <span className="text-[17px] font-bold mono tracking-wide text-text-1">{selectedLoc}</span>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-[10px] text-text-2 border border-border rounded px-1.5 py-0.5 hover:border-border-strong hover:text-text-1"
                    >
                      <Copy className="h-2.5 w-2.5" />
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {currentStatus.key === 'normal' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-live/35 bg-live-dim text-live">
                        <span className="w-1.5 h-1.5 rounded-full bg-live" /> Live
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border ${
                        currentStatus.cls === 'warn' ? 'border-warn/40 bg-warn-dim text-warn' : 'border-crit/40 bg-crit-dim text-crit'
                      }`}>
                        {currentStatus.label}
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-border bg-surface-2 text-text-2">
                      Level {parsedSelected.level} — {currentFacts.levelDef.label}
                    </span>
                  </div>

                  <nav className="flex items-center gap-1 text-[11px] text-text-3 mt-2">
                    <span className="mono text-text-2">{CONFIG.warehouse.id}</span>
                    <span>›</span>
                    <span>{CONFIG.side.name}</span>
                    <span>›</span>
                    <span>Row {parsedSelected.row}</span>
                    <span>›</span>
                    <span>Bay {pad2(parsedSelected.bay)}</span>
                    <span>›</span>
                    <b className="text-text-1 font-semibold">Level {parsedSelected.level}</b>
                  </nav>
                </div>

                {/* DRAWER BODY */}
                <div className="flex-1 overflow-y-auto p-3 min-h-0 space-y-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-text-3 mb-1.5 font-medium">
                      Rack elevation — bay {bayCode(parsedSelected.row, parsedSelected.bay)}
                    </div>

                    <div className="flex flex-col gap-1">
                      {[...CONFIG.levels].reverse().map(l => {
                        const lc = locCode(parsedSelected.row, parsedSelected.bay, l.id);
                        const f = locFacts(lc);
                        const isCurrent = l.id === parsedSelected.level;

                        return (
                          <button
                            key={l.id}
                            onClick={() => selectLocation(lc)}
                            className={`grid grid-cols-[64px_1fr_86px] items-center gap-2 p-1.5 px-2 rounded border bg-bg-1 text-left transition ${
                              isCurrent ? 'border-live bg-live-dim' : 'border-border hover:border-border-strong'
                            }`}
                          >
                            <span className="text-xs font-semibold mono flex items-center gap-1 text-text-1">
                              {l.access === 'forklift' ? (
                                <AlertTriangle className="h-3 w-3 text-warn" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 text-live" />
                              )}
                              {lc}
                            </span>
                            <span className="h-1.5 rounded-full bg-surface-3 overflow-hidden block">
                              <span
                                className="block h-full rounded-full"
                                style={{ width: `${f.occ}%`, background: isCurrent ? 'var(--live)' : 'var(--text-3)' }}
                              />
                            </span>
                            <span className="text-[10px] text-text-2 text-right mono">
                              {f.occ}% · {f.platforms} plt
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-text-3 mb-1.5 font-medium">
                      Platforms at {selectedLoc}
                    </div>

                    <div className="space-y-1.5">
                      {platformsOf(selectedLoc).map((pl: any, i: number) => {
                        const isOpen = openPlatforms[i] ?? (i === 0);
                        return (
                          <div key={i} className="border border-border rounded overflow-hidden bg-bg-1">
                            <button
                              onClick={() => setOpenPlatforms(prev => ({ ...prev, [i]: !isOpen }))}
                              className="flex items-center gap-2 w-full p-2 text-left text-[11px] hover:bg-surface-2"
                            >
                              <ChevronRight className={`h-3 w-3 text-text-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                              <span className="font-semibold text-text-1">{pl.name}</span>
                              <span className="mono text-text-2">{pl.mu}</span>
                              <span className="text-text-3 text-[10px] ml-auto">{pl.boxes} boxes · {pl.layers}</span>
                            </button>

                            {isOpen && (
                              <div className="p-2 pt-1 border-t border-border">
                                <dl className="grid grid-cols-[88px_1fr] gap-x-2 gap-y-0.5 text-[11px]">
                                  <dt className="text-text-3">SKU</dt>
                                  <dd className="text-text-1"><span className="mono">{pl.sku}</span> — {pl.skuName}</dd>
                                  <dt className="text-text-3">Quantity</dt>
                                  <dd className="mono text-text-1">{pl.qty}</dd>
                                  <dt className="text-text-3">Lot</dt>
                                  <dd className="mono text-text-1">{pl.lot}</dd>
                                  <dt className="text-text-3">Status</dt>
                                  <dd className={pl.status === 'Active' ? 'text-live' : 'text-warn'}>{pl.status}</dd>
                                </dl>

                                <div className="flex gap-1 flex-wrap mt-2">
                                  {Array.from({ length: pl.boxes }).map((_, bIdx) => (
                                    <span key={bIdx} className="w-3.5 h-2 rounded-[2px] bg-live-dim border border-live/50" />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-text-3">
                <Boxes className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-[11px]">
                  <b className="text-text-2">No location selected</b>
                  <br />
                  Select a bay on the map or a location code in the queue to inspect it here.
                </p>
              </div>
            )}
          </aside>
        </div>

        {/* BOTTOM ROW: QUEUE / OPTIMIZATION / AI ASSISTANT */}
        <div className="grid grid-cols-[1.72fr_1.02fr_0.94fr] gap-2 min-h-0">
          {/* FULFILLMENT QUEUE */}
          <section className="bg-surface border border-border rounded-md flex flex-col min-h-0 overflow-hidden">
            <div className="px-3 py-1.5 border-b border-border min-h-[30px] flex items-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-2">Fulfillment queue</span>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <table className="w-full text-[11px] table-fixed">
                <colgroup>
                  <col style={{ width: '56px' }} />
                  <col style={{ width: '72px' }} />
                  <col style={{ width: '80px' }} />
                  <col style={{ width: '96px' }} />
                  <col />
                  <col style={{ width: '108px' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-border text-[9px] uppercase tracking-wider text-text-3 font-semibold text-left">
                    <th className="p-1 px-2">Priority</th>
                    <th className="p-1 px-1">Order ID ▾</th>
                    <th className="p-1 px-1">Time rem. ▾</th>
                    <th className="p-1 px-1">State ▾</th>
                    <th className="p-1 px-1">Supply source</th>
                    <th className="p-1 px-1">Pick locations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {DATA.queue.rows.map(r => (
                    <tr
                      key={r.id}
                      className={`hover:bg-surface-2 transition ${highlightedOrder === r.id ? 'bg-live-dim' : ''}`}
                    >
                      <td className="p-1.5 px-2">
                        <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold mono ${
                          r.prio === 1
                            ? 'bg-crit-dim text-crit border border-crit/40'
                            : r.prio === 2
                            ? 'bg-warn-dim text-warn border border-warn/40'
                            : 'bg-surface-3 text-text-2 border border-border-strong'
                        }`}>
                          {r.prio}
                        </span>
                      </td>
                      <td className="p-1.5 px-1 mono">{r.id}</td>
                      <td className="p-1.5 px-1 mono">{r.time}</td>
                      <td className="p-1.5 px-1">
                        <span className="inline-flex items-center gap-1.5 text-[11px]">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            r.state === 'Picking' ? 'bg-live' : r.state === 'Waiting stock' ? 'bg-warn' : r.state === 'Allocated' ? 'bg-blue-300' : 'bg-text-3'
                          }`} />
                          {r.state}
                        </span>
                      </td>
                      <td className="p-1.5 px-1 text-text-2 truncate" title={r.source}>{r.source}</td>
                      <td className="p-1.5 px-1">
                        {r.locs.map(l => (
                          <button
                            key={l}
                            onClick={() => selectLocation(l)}
                            className="mono text-[10px] px-1.5 py-0.5 rounded border border-border-strong text-text-1 bg-surface-2 hover:border-focus hover:text-focus mr-1"
                          >
                            {l}
                          </button>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center px-3 py-1 border-t border-border text-[10px] text-text-3 mono flex-none">
              Showing {DATA.queue.shown} of {DATA.queue.total.toLocaleString("en-US")} pending orders
            </div>
          </section>

          {/* OPTIMIZATION COMPARISON (SIMULATED TREATMENT) */}
          <section className="bg-surface border border-dashed border-border-strong rounded-md flex flex-col min-h-0 overflow-hidden">
            <div className="px-3 py-1.5 border-b border-border min-h-[30px] flex items-center gap-2 flex-wrap flex-none">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-2">Baseline vs. Proposal 4a</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-2 border border-dashed border-border-strong rounded px-1.5 py-0.5">
                Simulated
              </span>
              <span className="text-[10px] text-text-3 mono ml-auto">
                {simRun === 1 ? 'SIM-2042' : DATA.sim.runId} · seed {simRun === 1 ? 50617 : DATA.sim.seed} · {DATA.sim.horizonH} h
              </span>
            </div>

            <div className="flex-1 p-2 px-3 overflow-auto min-h-0">
              {simBusy ? (
                <div className="flex flex-col gap-2 pt-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="skel h-4" style={{ width: `${90 - i * 8}%` }} />
                  ))}
                </div>
              ) : (
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-3 font-semibold text-left">
                      <th className="p-1">Metric</th>
                      <th className="p-1 text-right mono">Baseline</th>
                      <th className="p-1 text-right mono">{DATA.sim.proposal}</th>
                      <th className="p-1 text-right mono">Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {DATA.sim.metrics.map(m => (
                      <tr key={m.name}>
                        <td className="p-1 text-text-1">
                          {m.name} {m.unit && <span className="text-text-3">({m.unit})</span>}
                        </td>
                        <td className="p-1 text-right mono text-text-1">{m.base}</td>
                        <td className="p-1 text-right mono text-text-1">{m.prop}</td>
                        <td className="p-1 text-right mono text-live font-semibold">{m.delta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {simRun === 1 && (
              <div className="m-2 mt-0 p-1 px-2 border border-dashed border-border-strong rounded text-[10px] text-text-3">
                Simulation complete — values verified against golden snapshot
              </div>
            )}
          </section>

          {/* AI OPERATIONS ASSISTANT */}
          <section className="bg-surface border border-border rounded-md flex flex-col min-h-0 overflow-hidden" style={{ background: 'linear-gradient(0deg, rgba(129,140,248,.07), rgba(129,140,248,.07)), #101828' }}>
            <div className="px-3 py-1.5 border-b border-border min-h-[30px] flex items-center justify-between flex-none">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-2">AI Operations Assistant</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider text-ai border border-ai/40 rounded px-1.5 py-0.5">
                <Sparkles className="h-2.5 w-2.5" /> AI
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0 text-[11px]">
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-text-3 mb-0.5 font-semibold">Observation</h4>
                <p className="text-text-1 leading-relaxed">{DATA.ai.observation}</p>
              </div>

              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-text-3 mb-1 font-semibold">Evidence</h4>
                <div className="flex flex-wrap gap-1">
                  {DATA.ai.evidence.map(e => (
                    <button
                      key={e}
                      onClick={() => {
                        if (parseLoc(e)) selectLocation(e);
                        else if (e.startsWith('ORD-')) setHighlightedOrder(e);
                      }}
                      className="text-[10px] mono px-1.5 py-0.5 rounded border border-ai/35 text-ai bg-indigo-500/10 hover:border-ai hover:text-indigo-200 transition"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-text-3 mb-0.5 font-semibold">Proposed plan</h4>
                <div className="border border-warn/55 rounded bg-warn-dim p-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-warn flex items-center gap-1 mb-0.5">
                    <Clock className="h-3 w-3" />
                    <span>{modalApproved ? 'Approved — replenishment queued for 14:00' : 'Proposed — awaiting approval'}</span>
                  </div>
                  <p className="text-text-1 text-[11px] leading-relaxed">{DATA.ai.plan}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 p-3 pt-0 flex-none">
              <button
                onClick={() => setModalOpen(true)}
                className="h-7 px-3 rounded text-[11px] font-semibold bg-live hover:bg-[#5EEAD4] text-[#06231F] transition"
              >
                Review Plan
              </button>
              <button
                onClick={handleSimulate}
                disabled={simBusy}
                className="h-7 px-3 rounded text-[11px] font-semibold border border-border-strong text-text-1 hover:border-text-3 transition disabled:opacity-50"
              >
                {simBusy ? 'Simulating…' : 'Simulate'}
              </button>
            </div>
          </section>
        </div>

        {/* ==================== FOOTER ==================== */}
        <footer className="flex items-center gap-4 bg-surface border border-border rounded-md px-3 text-[10px] text-text-3 overflow-hidden whitespace-nowrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-live" /> Live · synchronized
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm border border-dashed border-text-2" /> Simulated · run ID + seed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-indigo-500/35 border border-ai/50" /> AI-generated
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm border border-warn bg-warn-dim" /> Proposed · awaiting approval
          </span>

          <span className="ml-auto flex items-center gap-3">
            {!feedErrorDismissed && (
              <span className="text-crit flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Transfer feed MKT-03 unavailable — retrying
                <button onClick={() => setFeedErrorDismissed(true)} className="underline underline-offset-2 ml-1 text-crit">
                  Dismiss
                </button>
              </span>
            )}
          </span>
        </footer>
      </main>

      {/* ==================== REVIEW PLAN MODAL ==================== */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="w-[520px] max-h-[640px] bg-surface border border-border-strong rounded-md flex flex-col shadow-2xl">
            <div className="flex items-center gap-2 p-3 px-4 border-b border-border">
              <h2 className="text-[13px] font-semibold text-text-1">Review proposed plan</h2>
              <span className="text-[10px] px-2 py-0.5 rounded border border-warn/40 bg-warn-dim text-warn ml-2">
                Awaiting approval
              </span>
              <button onClick={() => setModalOpen(false)} className="ml-auto text-text-2 hover:text-text-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex flex-col gap-3 text-xs leading-relaxed">
              <div className="flex gap-3 text-[11px] text-text-2 mono flex-wrap">
                <span>Source run <b className="text-text-1">SIM-2041</b></span>
                <span>Affected orders <b className="text-text-1">28</b> (of 78 at risk)</span>
                <span>Window <b className="text-text-1">13:00–14:00</b></span>
              </div>

              <ol className="list-decimal pl-5 space-y-1.5 text-text-1">
                <li>Defer forklift replenishment at <span className="mono font-semibold">EH14D</span> from 13:00 to <b>14:00–14:30</b>.</li>
                <li>Re-route <b>9 manual picks</b> from <span className="mono font-semibold">EH14A–C</span> to <span className="mono font-semibold">EC07A</span> (stock verified, 216 units available).</li>
                <li>Hold wave release for orders <span className="mono font-semibold">ORD-8812</span> and <span className="mono font-semibold">ORD-8814</span> until re-route confirms.</li>
              </ol>

              <label className="flex items-start gap-2 p-2 border border-border rounded bg-bg-1 cursor-pointer text-[11px] text-text-2 mt-1">
                <input
                  type="checkbox"
                  checked={reviewChecked}
                  onChange={e => setReviewChecked(e.target.checked)}
                  className="mt-0.5 accent-live"
                />
                <span>I reviewed the simulation results (SIM-2041, seed 48213, 8 h horizon) and the 28 affected orders.</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 p-3 px-4 border-t border-border">
              <button
                onClick={() => setModalOpen(false)}
                className="h-7 px-3 rounded text-[11px] font-semibold border border-border-strong text-text-1 hover:border-text-3 transition"
              >
                Cancel
              </button>
              <button
                disabled={!reviewChecked}
                onClick={() => {
                  setModalApproved(true);
                  setModalOpen(false);
                }}
                className="h-7 px-3 rounded text-[11px] font-semibold bg-live hover:bg-[#5EEAD4] text-[#06231F] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
