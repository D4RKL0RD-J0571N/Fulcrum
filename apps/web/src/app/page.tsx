'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Package,
  Layers,
  ClipboardList,
  History,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  ExternalLink,
  Copy,
  Check,
  Printer,
  ChevronRight,
  SlidersHorizontal,
  Info,
  ShieldAlert,
  Boxes,
  CheckSquare
} from 'lucide-react';

import {
  Order,
  OrderRequirementLine,
  StockObservation,
  PlanningRun,
  OrderMaterialPlanner,
  resolveCurrentObservations,
  normalizeLocationKey,
  normalizeMuKey,
  ItemExtractionLine
} from '@fulcrum/domain';

import {
  createInitialPlanningState,
  PlanningAppState,
  SEED_REFERENCE_TIME
} from '../lib/planningStore';
import { ThemeToggle } from '../components/ThemeToggle';

export default function MaterialPlanningPage() {
  const [state, setState] = useState<PlanningAppState>(() => createInitialPlanningState());
  const [activeTab, setActiveTab] = useState<'plan' | 'orders' | 'observations' | 'history'>('plan');
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Stale threshold setting
  const [staleThreshold, setStaleThreshold] = useState<number>(60);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Floor checklist state: independent of planning inputs, persisted in localStorage by runId
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({});
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // New Order Form state
  const [orderModalOpen, setOrderModalOpen] = useState<boolean>(false);
  const [newOrderId, setNewOrderId] = useState<string>('');
  const [newOrderPriority, setNewOrderPriority] = useState<'HIGH' | 'STANDARD' | 'LOW'>('STANDARD');
  const [newOrderNotes, setNewOrderNotes] = useState<string>('');
  const [newOrderLines, setNewOrderLines] = useState<Array<{ sku: string; name: string; qty: number }>>([
    { sku: '', name: '', qty: 1 }
  ]);

  // New Observation Form state
  const [obsModalOpen, setObsModalOpen] = useState<boolean>(false);
  const [newObsSku, setNewObsSku] = useState<string>('');
  const [newObsMuId, setNewObsMuId] = useState<string>('');
  const [newObsName, setNewObsName] = useState<string>('');
  const [newObsQty, setNewObsQty] = useState<number>(1);
  const [newObsLocation, setNewObsLocation] = useState<string>('');
  const [newObsNotes, setNewObsNotes] = useState<string>('');

  // Selected historic run viewer
  const [selectedHistoricalRun, setSelectedHistoricalRun] = useState<PlanningRun | null>(null);

  // Known materials registry (extracted dynamically from orders & observations)
  const knownMaterials = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of state.orders) {
      for (const l of o.lines) {
        if (!map.has(l.materialSku)) {
          map.set(l.materialSku, l.materialName || l.materialSku);
        }
      }
    }
    for (const obs of state.observations) {
      if (!map.has(obs.materialSku)) {
        map.set(obs.materialSku, obs.materialSku);
      }
    }
    return Array.from(map.entries()).map(([sku, name]) => ({ sku, name }));
  }, [state.orders, state.observations]);

  // Deduplicated current active observations
  const currentObservations = useMemo(() => {
    return resolveCurrentObservations(state.observations);
  }, [state.observations]);

  // Format relative minutes
  const formatAge = (timestamp: number) => {
    const now = isMounted ? Date.now() : SEED_REFERENCE_TIME;
    const diffMins = Math.max(0, Math.round((now - timestamp) / (60 * 1000)));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const hours = Math.floor(diffMins / 60);
    return `${hours}h ${diffMins % 60}m ago`;
  };

  // Helper to recompute plan reactively
  const recompute = (orders: Order[], selectedIds: string[], observations: StockObservation[]) => {
    return OrderMaterialPlanner.calculatePlan(
      orders,
      selectedIds,
      observations,
      { staleThresholdMinutes: staleThreshold, referenceTime: Date.now() }
    );
  };

  // Run explicit calculation
  const handleCalculatePlan = () => {
    const newPlan = recompute(state.orders, state.selectedOrderIds, state.observations);
    setState(prev => ({
      ...prev,
      currentPlan: newPlan,
      history: [newPlan, ...prev.history.slice(0, 19)]
    }));
  };

  // Toggle order selection
  const handleToggleOrder = (orderId: string) => {
    setState(prev => {
      const exists = prev.selectedOrderIds.includes(orderId);
      const nextIds = exists
        ? prev.selectedOrderIds.filter(id => id !== orderId)
        : [...prev.selectedOrderIds, orderId];
      const newPlan = recompute(prev.orders, nextIds, prev.observations);
      return { ...prev, selectedOrderIds: nextIds, currentPlan: newPlan };
    });
  };

  const handleSelectAllOrders = () => {
    setState(prev => {
      const nextIds = prev.orders.map(o => o.orderId);
      const newPlan = recompute(prev.orders, nextIds, prev.observations);
      return {
        ...prev,
        selectedOrderIds: nextIds,
        currentPlan: newPlan
      };
    });
  };

  const handleDeselectAllOrders = () => {
    setState(prev => {
      const nextIds: string[] = [];
      const newPlan = recompute(prev.orders, nextIds, prev.observations);
      return {
        ...prev,
        selectedOrderIds: nextIds,
        currentPlan: newPlan
      };
    });
  };

  // Add order
  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderId.trim()) {
      alert('Please enter an Order ID.');
      return;
    }
    const validLines = newOrderLines.filter(l => l.sku.trim() && l.qty > 0);
    if (validLines.length === 0) {
      alert('Please add at least one material line with a valid quantity.');
      return;
    }

    const order: Order = {
      orderId: newOrderId.trim(),
      priority: newOrderPriority,
      createdAt: Date.now(),
      notes: newOrderNotes.trim() || undefined,
      lines: validLines.map((l, idx) => ({
        lineId: `line_${Date.now()}_${idx}`,
        materialSku: l.sku.trim(),
        materialName: l.name.trim() || undefined,
        requestedQuantity: l.qty
      }))
    };

    setState(prev => {
      const nextOrders = [order, ...prev.orders];
      const nextSelected = [...prev.selectedOrderIds, order.orderId];
      const newPlan = recompute(nextOrders, nextSelected, prev.observations);
      return {
        ...prev,
        orders: nextOrders,
        selectedOrderIds: nextSelected,
        currentPlan: newPlan
      };
    });

    setNewOrderId('');
    setNewOrderNotes('');
    setNewOrderLines([{ sku: '', name: '', qty: 1 }]);
    setOrderModalOpen(false);
  };

  // Add/Refresh Observation
  const handleSaveObservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newObsSku.trim()) {
      alert('Please enter a Material SKU.');
      return;
    }

    const obs: StockObservation = {
      observationId: `obs_${Date.now()}`,
      muId: newObsMuId.trim() || undefined,
      materialSku: newObsSku.trim(),
      observedQuantity: Math.max(0, newObsQty),
      location: newObsLocation.trim() || undefined,
      observedAt: Date.now(),
      notes: newObsNotes.trim() || undefined
    };

    setState(prev => {
      const nextObs = [obs, ...prev.observations];
      const newPlan = recompute(prev.orders, prev.selectedOrderIds, nextObs);
      return {
        ...prev,
        observations: nextObs,
        currentPlan: newPlan
      };
    });

    setNewObsSku('');
    setNewObsMuId('');
    setNewObsName('');
    setNewObsQty(1);
    setNewObsLocation('');
    setNewObsNotes('');
    setObsModalOpen(false);
  };

  // Delete Order
  const handleDeleteOrder = (orderId: string) => {
    setState(prev => {
      const nextOrders = prev.orders.filter(o => o.orderId !== orderId);
      const nextSelected = prev.selectedOrderIds.filter(id => id !== orderId);
      const newPlan = recompute(nextOrders, nextSelected, prev.observations);
      return {
        ...prev,
        orders: nextOrders,
        selectedOrderIds: nextSelected,
        currentPlan: newPlan
      };
    });
  };

  // Delete Observation
  const handleDeleteObservation = (obsId: string) => {
    setState(prev => {
      const nextObs = prev.observations.filter(o => o.observationId !== obsId);
      const newPlan = recompute(prev.orders, prev.selectedOrderIds, nextObs);
      return {
        ...prev,
        observations: nextObs,
        currentPlan: newPlan
      };
    });
  };

  const displayedPlan = selectedHistoricalRun || state.currentPlan;

  // Load and persist floor checklist progress by runId
  useEffect(() => {
    if (typeof window === 'undefined' || !displayedPlan?.runId) return;
    try {
      const saved = localStorage.getItem(`fulcrum_checklist_${displayedPlan.runId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setCheckedTasks(parsed.tasks || {});
        setCheckedItems(parsed.items || {});
      } else {
        setCheckedTasks({});
        setCheckedItems({});
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, [displayedPlan?.runId]);

  const persistChecklist = (newTasks: Record<string, boolean>, newItems: Record<string, boolean>) => {
    if (typeof window === 'undefined' || !displayedPlan?.runId) return;
    try {
      localStorage.setItem(
        `fulcrum_checklist_${displayedPlan.runId}`,
        JSON.stringify({ tasks: newTasks, items: newItems })
      );
    } catch {
      // Ignore storage errors
    }
  };

  const handleToggleTaskCheck = (taskId: string, items: ItemExtractionLine[]) => {
    const nextVal = !checkedTasks[taskId];
    const nextTasks = { ...checkedTasks, [taskId]: nextVal };
    const nextItems = { ...checkedItems };
    for (const it of items) {
      nextItems[`${taskId}::${it.materialSku}`] = nextVal;
    }
    setCheckedTasks(nextTasks);
    setCheckedItems(nextItems);
    persistChecklist(nextTasks, nextItems);
  };

  const handleToggleItemCheck = (taskId: string, sku: string, allItems: ItemExtractionLine[]) => {
    const key = `${taskId}::${sku}`;
    const nextVal = !checkedItems[key];
    const nextItems = { ...checkedItems, [key]: nextVal };

    const allChecked = allItems.every(it => {
      const itKey = `${taskId}::${it.materialSku}`;
      return itKey === key ? nextVal : !!nextItems[itKey];
    });

    const nextTasks = { ...checkedTasks, [taskId]: allChecked };
    setCheckedTasks(nextTasks);
    setCheckedItems(nextItems);
    persistChecklist(nextTasks, nextItems);
  };

  const handleResetChecklist = () => {
    setCheckedTasks({});
    setCheckedItems({});
    persistChecklist({}, {});
  };

  // Copy pick list to clipboard
  const handleCopyPickList = () => {
    const planToCopy = selectedHistoricalRun || state.currentPlan;
    if (!planToCopy) return;

    const lines = [
      `FULCRUM PHYSICAL COLLECTION PLAN — Plan ${planToCopy.runId}`,
      `Calculated: ${new Date(planToCopy.calculatedAt).toLocaleString()}`,
      `Physical MUs to Collect: ${planToCopy.summary.totalManipulationUnitsToCollect} (${planToCopy.summary.totalLooseStockTasks} loose tasks)`,
      `Total Pieces to Pick: ${planToCopy.summary.totalPiecesAllocated}u`,
      planToCopy.summary.hasUnresolvedConflicts
        ? `*** WARNING: PLAN HAS ${planToCopy.summary.conflictingMuCount} UNRESOLVED MU LOCATION CONFLICT(S). RESOLVE BEFORE PROCEEDING TO FLOOR. ***`
        : `Status: Plan Ready for Collection`,
      `Note: Reported Stock Observations — Verify physical availability during checkout.`,
      `----------------------------------------------------`,
      ...planToCopy.pickList.map(task => {
        let locString = task.location;
        if (task.hasLocationConflict) {
          locString = `⚠️ LOCATION CONFLICT: ${task.conflictingLocations?.join(' vs ')} (REQUIRES RESOLUTION)`;
        } else if (task.isUnspecifiedLocation) {
          locString = `Location unspecified (Verify prior to collection)`;
        }
        const header = task.isLoose
          ? `[LOOSE STOCK @ ${locString}] (${task.totalPieces} pieces) — Orders: ${task.fulfillingOrderIds.join(', ')}`
          : `[MU #${task.muId} @ ${locString}] (${task.totalPieces} pieces) — Orders: ${task.fulfillingOrderIds.join(', ')}`;
        const items = task.items.map(it =>
          `  • ${it.materialSku} (${it.materialName || 'Item'}) x ${it.quantity}u -> ${it.allocations.map(a => `${a.orderId} (${a.quantity}u)`).join(', ')}`
        );
        return [header, ...items].join('\n');
      })
    ];

    if (planToCopy.shortages.length > 0) {
      lines.push(`----------------------------------------------------`);
      lines.push(`SHORTAGES / UNCOVERED DEMAND:`);
      planToCopy.shortages.forEach(s => {
        lines.push(`Order ${s.orderId}: ${s.materialSku} shortage of ${s.shortageQuantity}u (${s.reason})`);
      });
    }

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-bg-app text-text-primary flex flex-col font-sans select-none">
      {/* ==================== TOP NAVIGATION / HEADER ==================== */}
      <header className="border-b border-border-subtle bg-bg-surface px-4 py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-xs no-print">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-accent flex items-center justify-center text-bg-surface font-bold text-xs">
              F
            </div>
            <span className="font-semibold text-sm tracking-tight text-text-primary">Fulcrum</span>
          </div>

          <span className="text-border-strong text-xs font-light">|</span>

          <span className="text-xs text-text-secondary hidden sm:inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent" />
            MU Collection & Material Planner
          </span>

          <span className="text-[11px] px-2 py-0.5 rounded bg-bg-elevated border border-border-subtle text-text-muted font-mono hidden md:inline">
            Offline Billing Companion
          </span>
        </div>

        {/* Global Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-bg-elevated p-1 rounded-md border border-border-subtle text-xs">
          <button
            onClick={() => { setActiveTab('plan'); setSelectedHistoricalRun(null); }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-medium transition ${
              activeTab === 'plan' && !selectedHistoricalRun
                ? 'bg-bg-surface text-text-primary shadow-xs font-semibold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Boxes className="h-3.5 w-3.5 text-accent" />
            <span>MU Pick Plan</span>
            {displayedPlan && (
              <span className="text-[10px] mono px-1.5 py-0.2 rounded bg-accent-dim text-accent font-bold">
                {displayedPlan.summary.totalManipulationUnitsToCollect} MUs
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab('orders'); setSelectedHistoricalRun(null); }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-medium transition ${
              activeTab === 'orders'
                ? 'bg-bg-surface text-text-primary shadow-xs font-semibold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            <span>Orders ({state.orders.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('observations'); setSelectedHistoricalRun(null); }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-medium transition ${
              activeTab === 'observations'
                ? 'bg-bg-surface text-text-primary shadow-xs font-semibold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>Stock Observations ({currentObservations.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('history'); }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-medium transition ${
              activeTab === 'history' || selectedHistoricalRun
                ? 'bg-bg-surface text-text-primary shadow-xs font-semibold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Runs ({state.history.length})</span>
          </button>
        </nav>

        {/* Right Tools: Theme & Quick Action */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={handleCalculatePlan}
            className="flex items-center gap-1.5 px-3 py-1 bg-accent hover:bg-accent-hover text-white rounded text-xs font-semibold transition shadow-xs active:translate-y-0.5"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Recalculate</span>
          </button>
        </div>
      </header>

      {/* ==================== MAIN CONTENT CONTAINER ==================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-4">
        {/* ==================== PRINT ONLY HEADER ==================== */}
        {displayedPlan && activeTab === 'plan' && (
          <div className="hidden print-only mb-4 border-b-2 border-black pb-2">
            <div className="flex justify-between items-baseline">
              <h1 className="text-lg font-bold">FULCRUM PHYSICAL MU COLLECTION PLAN</h1>
              <span className="text-xs font-mono">Plan: {displayedPlan.runId}</span>
            </div>
            <div className="text-xs mt-1 text-gray-800" suppressHydrationWarning>
              Printed: {isMounted ? new Date().toLocaleString() : 'Ready'} | Scope: {displayedPlan.selectedOrderIds.length} orders | Distinct MUs: {displayedPlan.summary.totalManipulationUnitsToCollect} | Pieces: {displayedPlan.summary.totalPiecesAllocated}u
            </div>
            {displayedPlan.summary.hasUnresolvedConflicts && (
              <div className="text-xs font-bold text-red-600 mt-1 print-conflict-warning">
                ⚠️ OPERATIONAL WARNING: {displayedPlan.summary.conflictingMuCount} MU(S) HAVE CONFLICTING LOCATIONS — RESOLVE BEFORE WAREHOUSE FLOOR COLLECTION
              </div>
            )}
          </div>
        )}

        {/* ==================== CORE DISCLAIMER BANNER ==================== */}
        <div className="bg-bg-surface border border-border-subtle rounded-md p-3 px-4 flex items-start gap-3 text-xs leading-relaxed no-print">
          <ShieldAlert className="h-4 w-4 text-warn flex-none mt-0.5" />
          <div className="flex-1 text-text-secondary">
            <span className="font-semibold text-text-primary">Offline Stock Observations: </span>
            Quantities are externally reported snapshots from your checkout and billing screens. Stock is not guaranteed, reserved, or live-synchronized with the warehouse floor. Always verify physical availability during checkout.
          </div>
          <div className="flex items-center gap-2 flex-none pl-3 border-l border-border-subtle">
            <span className="text-[11px] text-text-muted">Stale threshold:</span>
            <select
              value={staleThreshold}
              onChange={e => setStaleThreshold(Number(e.target.value))}
              className="bg-bg-elevated border border-border-subtle rounded px-2 py-0.5 text-xs text-text-primary outline-none"
            >
              <option value={30}>30 mins</option>
              <option value={60}>60 mins (Default)</option>
              <option value={120}>2 hours</option>
              <option value={240}>4 hours</option>
            </select>
          </div>
        </div>

        {/* ==================== TAB 1: PLANNING & MU PICK LIST ==================== */}
        {activeTab === 'plan' && displayedPlan && (
          <div className="flex flex-col gap-4">
            {/* Historical Run Banner notice if viewing an older snapshot */}
            {selectedHistoricalRun && (
              <div className="bg-warn-dim border border-warn/40 rounded-md p-3 px-4 flex items-center justify-between text-xs text-warn no-print">
                <div className="flex items-center gap-2 font-medium">
                  <History className="h-4 w-4" />
                  Viewing Historical Frozen Plan Snapshot: <span className="font-mono font-bold">{selectedHistoricalRun.runId}</span> (Calculated {new Date(selectedHistoricalRun.calculatedAt).toLocaleTimeString()})
                </div>
                <button
                  onClick={() => setSelectedHistoricalRun(null)}
                  className="px-2 py-1 rounded bg-bg-surface text-text-primary border border-border-subtle hover:bg-bg-elevated font-semibold text-xs"
                >
                  Return to Latest Current Plan
                </button>
              </div>
            )}

            {/* Unresolved Conflict Readiness Alert */}
            {displayedPlan.summary.hasUnresolvedConflicts && (
              <div className="bg-crit-dim border border-crit/40 rounded-md p-3.5 px-4 flex items-center justify-between gap-3 text-xs text-crit font-medium print-conflict-warning">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="h-5 w-5 flex-none" />
                  <div>
                    <span className="font-bold uppercase tracking-wider block">Plan Not Ready for Floor Collection</span>
                    <span>
                      {displayedPlan.summary.conflictingMuCount} physical MU(s) in this plan have conflicting location observations. Verify bay locations before sending workers to the floor to avoid wasted trips.
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded bg-crit text-white font-mono text-[11px] font-bold flex-none">
                  Resolution Required
                </span>
              </div>
            )}

            {/* Top Planning Action & Scope Bar */}
            <div className="bg-bg-surface border border-border-subtle rounded-md p-3.5 flex flex-wrap items-center justify-between gap-3 no-print">
              <div className="flex items-center gap-3">
                <div className="text-xs">
                  <span className="text-text-muted">Selected Scope: </span>
                  <span className="font-semibold text-text-primary">{state.selectedOrderIds.length} of {state.orders.length} orders</span>
                  <span className="text-text-muted ml-2">({displayedPlan.summary.totalPiecesRequested} pieces requested)</span>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={handleSelectAllOrders}
                    className="text-[11px] px-2 py-0.5 rounded border border-border-subtle hover:bg-bg-elevated text-text-secondary"
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleDeselectAllOrders}
                    className="text-[11px] px-2 py-0.5 rounded border border-border-subtle hover:bg-bg-elevated text-text-secondary"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyPickList}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border-subtle hover:bg-bg-elevated text-text-secondary hover:text-text-primary text-xs font-medium transition"
                >
                  {copySuccess ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copySuccess ? 'Copied to Clipboard' : 'Copy Collection Plan'}</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border-subtle hover:bg-bg-elevated text-text-secondary hover:text-text-primary text-xs font-medium transition"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Plan</span>
                </button>
              </div>
            </div>

            {/* Floor Collection Checklist Progress Bar */}
            <div className="bg-bg-surface border border-border-subtle rounded-md p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-accent" />
                  <span className="font-semibold text-text-primary">Floor Collection Checklist:</span>
                  <span className="font-mono font-bold text-accent">
                    {displayedPlan.pickList.filter(t => !!checkedTasks[t.taskId]).length} / {displayedPlan.pickList.length} units collected
                  </span>
                  <span className="text-text-muted text-[11px]">
                    ({displayedPlan.pickList.length > 0 ? Math.round((displayedPlan.pickList.filter(t => !!checkedTasks[t.taskId]).length / displayedPlan.pickList.length) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-24 h-2 bg-bg-muted rounded-full overflow-hidden hidden sm:block">
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{
                      width: `${displayedPlan.pickList.length > 0 ? Math.round((displayedPlan.pickList.filter(t => !!checkedTasks[t.taskId]).length / displayedPlan.pickList.length) * 100) : 0}%`
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                {displayedPlan.pickList.filter(t => !!checkedTasks[t.taskId]).length > 0 && (
                  <button
                    onClick={handleResetChecklist}
                    className="text-[11px] px-2 py-0.5 rounded border border-border-subtle hover:bg-bg-elevated text-text-muted hover:text-text-primary transition"
                  >
                    Reset Checklist
                  </button>
                )}
              </div>
            </div>

            {/* Operational Summary KPI Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-bg-surface border border-border-subtle rounded-md p-3">
                <span className="text-[10px] uppercase font-semibold text-text-muted">Physical MUs to Collect</span>
                <div className="text-lg font-bold mono mt-1 flex items-baseline gap-2">
                  <span className="text-accent text-xl">{displayedPlan.summary.totalManipulationUnitsToCollect}</span>
                  <span className="text-xs text-text-muted font-normal font-sans">
                    {displayedPlan.summary.totalLooseStockTasks > 0
                      ? `(+ ${displayedPlan.summary.totalLooseStockTasks} loose)`
                      : 'boxes'}
                  </span>
                </div>
              </div>

              <div className="bg-bg-surface border border-border-subtle rounded-md p-3">
                <span className="text-[10px] uppercase font-semibold text-text-muted">Pieces to Pick / Extract</span>
                <div className="text-lg font-bold mono text-text-primary mt-1 flex items-baseline gap-1.5">
                  <span>{displayedPlan.summary.totalPiecesAllocated}</span>
                  <span className="text-xs font-normal text-text-muted font-sans">
                    / {displayedPlan.summary.totalPiecesRequested} requested
                  </span>
                </div>
              </div>

              <div className="bg-bg-surface border border-border-subtle rounded-md p-3">
                <span className="text-[10px] uppercase font-semibold text-text-muted">Shortages / Deficits</span>
                <div className={`text-lg font-bold mono mt-1 ${
                  displayedPlan.summary.totalPiecesShortage > 0 ? 'text-crit' : 'text-text-muted'
                }`}>
                  {displayedPlan.summary.totalPiecesShortage} <span className="text-xs font-normal text-text-muted font-sans">pieces</span>
                </div>
              </div>

              <div className="bg-bg-surface border border-border-subtle rounded-md p-3">
                <span className="text-[10px] uppercase font-semibold text-text-muted">Order Completeness</span>
                <div className="text-lg font-bold mono mt-1 flex items-baseline gap-2">
                  <span className={displayedPlan.summary.totalPiecesShortage > 0 ? 'text-warn' : 'text-success'}>
                    {displayedPlan.summary.totalPiecesRequested > 0
                      ? `${Math.round((displayedPlan.summary.totalPiecesAllocated / displayedPlan.summary.totalPiecesRequested) * 100)}%`
                      : '0%'}
                  </span>
                  <span className="text-xs text-text-muted font-normal font-sans">
                    ({displayedPlan.summary.fullyFulfilledOrders} / {displayedPlan.summary.totalOrdersSelected} full)
                  </span>
                </div>
              </div>
            </div>

            {/* Warnings Alert Box if any */}
            {displayedPlan.warnings.length > 0 && (
              <div className="bg-bg-surface border border-warn/30 rounded-md p-3 space-y-1.5">
                <div className="text-xs font-semibold text-warn flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Planning Assumptions & Observations Warnings ({displayedPlan.warnings.length})
                </div>
                <div className="space-y-1 text-xs text-text-secondary pl-5">
                  {displayedPlan.warnings.map((w, idx) => (
                    <div key={idx} className="list-disc">
                      • {w.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ==================== 1. RECOMMENDED PHYSICAL MU COLLECTION PLAN ==================== */}
            <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden shadow-xs">
              <div className="p-3 px-4 border-b border-border-subtle bg-bg-elevated flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                    <Boxes className="h-4 w-4 text-accent" />
                    Physical Manipulation Units to Collect (Pick Sequence)
                  </h2>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Identifies each physical container to pull, the orders it supports, and items to extract.
                  </p>
                </div>
                <div className="text-xs mono font-semibold text-text-secondary flex items-center gap-3">
                  <span>{displayedPlan.summary.totalManipulationUnitsToCollect} physical MUs</span>
                  <span>{displayedPlan.summary.totalPiecesAllocated} total pieces</span>
                </div>
              </div>

              {displayedPlan.pickList.length === 0 ? (
                <div className="p-8 text-center text-xs text-text-muted">
                  No allocations generated. Either no orders are selected or no eligible stock observations match requested materials.
                </div>
              ) : (
                <div className="p-3.5 space-y-3">
                  {displayedPlan.pickList.map((task) => (
                    <div
                      key={task.taskId}
                      className={`border rounded-md bg-bg-surface overflow-hidden shadow-2xs transition print-avoid-break ${
                        task.hasLocationConflict
                          ? 'border-crit/50'
                          : checkedTasks[task.taskId]
                          ? 'border-success/40'
                          : 'border-border-subtle hover:border-border-strong'
                      }`}
                    >
                      {/* Conflicting Location Warning Banner on Card */}
                      {task.hasLocationConflict && (
                        <div className="p-2.5 px-3.5 bg-crit-dim border-b border-crit/30 flex items-center justify-between gap-2 text-xs text-crit font-bold print-conflict-warning">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 flex-none" />
                            <span>LOCATION CONFLICT: Reported at {task.conflictingLocations?.join(' vs ')}. Physical verification required.</span>
                          </div>
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-crit text-white font-mono flex-none">
                            Verify Bay
                          </span>
                        </div>
                      )}

                      {/* Physical Unit Header */}
                      <div className="p-2.5 px-3.5 bg-bg-elevated/70 border-b border-border-subtle flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2.5">
                          <label className="flex items-center gap-1.5 cursor-pointer select-none no-print pr-1">
                            <input
                              type="checkbox"
                              checked={!!checkedTasks[task.taskId]}
                              onChange={() => handleToggleTaskCheck(task.taskId, task.items)}
                              className="h-4 w-4 rounded border-border-strong text-accent focus:ring-accent accent-accent cursor-pointer"
                              aria-label={`Mark task ${task.muId || 'Loose'} collected`}
                            />
                            <span className="text-[11px] font-medium text-text-muted">
                              {checkedTasks[task.taskId] ? 'Collected' : 'Collect'}
                            </span>
                          </label>

                          {task.isLoose ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-bg-muted border border-border-subtle text-text-secondary flex items-center gap-1">
                              <Layers className="h-3 w-3" />
                              Loose / Uncontainerized Stock
                            </span>
                          ) : (
                            <span className="mono font-bold text-xs px-2.5 py-0.5 rounded bg-accent text-white flex items-center gap-1 shadow-2xs">
                              <Boxes className="h-3.5 w-3.5" />
                              MU #{task.muId}
                            </span>
                          )}

                          <span className="text-text-muted text-[11px]">at location</span>

                          {task.hasLocationConflict ? (
                            <span className="text-crit text-[11px] font-bold bg-crit-dim px-2 py-0.5 rounded border border-crit/40 print-conflict-warning">
                              {task.location}
                            </span>
                          ) : task.isUnspecifiedLocation ? (
                            <span className="text-warn text-[11px] font-medium bg-warn-dim px-2 py-0.5 rounded border border-warn/30">
                              Location unspecified
                            </span>
                          ) : (
                            <span className="mono font-semibold text-xs px-2 py-0.5 rounded bg-bg-surface border border-border-subtle text-text-primary">
                              {task.location}
                            </span>
                          )}

                          {task.isStale && (
                            <span className="text-warn text-[10px] font-semibold flex items-center gap-0.5">
                              <Clock className="h-3 w-3" /> Stale ({formatAge(task.observationTimestamp)})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-[11px] text-text-secondary">
                            <span className="text-text-muted">Supports Orders:</span>
                            <div className="flex flex-wrap gap-1">
                              {task.fulfillingOrderIds.map(id => (
                                <span
                                  key={id}
                                  className="mono font-bold text-[10px] px-1.5 py-0.2 rounded bg-bg-surface border border-border-subtle text-text-primary"
                                >
                                  {id}
                                </span>
                              ))}
                            </div>
                          </div>

                          <span className="mono font-bold text-accent text-xs pl-2 border-l border-border-subtle">
                            {task.totalPieces} pieces
                          </span>
                        </div>
                      </div>

                      {/* Extracted Items Table */}
                      <div className="p-2 px-3 overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="border-b border-border-subtle text-text-muted text-[10px] uppercase font-semibold">
                              <th className="py-1 px-2 text-center w-8 no-print">✓</th>
                              <th className="py-1 px-2">Material SKU</th>
                              <th className="py-1 px-2">Item Description</th>
                              <th className="py-1 px-2 text-right">Extract Qty</th>
                              <th className="py-1 px-2">Order Line Allocations</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-subtle/50 text-[11px]">
                            {task.items.map((item, iIdx) => {
                              const isItemChecked = !!checkedItems[`${task.taskId}::${item.materialSku}`];
                              return (
                                <tr key={iIdx} className={`hover:bg-bg-elevated/40 transition ${isItemChecked ? 'bg-success-dim/10' : ''}`}>
                                  <td className="py-1.5 px-2 text-center no-print">
                                    <input
                                      type="checkbox"
                                      checked={isItemChecked}
                                      onChange={() => handleToggleItemCheck(task.taskId, item.materialSku, task.items)}
                                      className="h-3.5 w-3.5 rounded border-border-strong text-accent focus:ring-accent accent-accent cursor-pointer"
                                      aria-label={`Mark ${item.materialSku} extracted`}
                                    />
                                  </td>
                                  <td className={`py-1.5 px-2 mono font-semibold text-text-primary ${isItemChecked ? 'line-through text-text-muted' : ''}`}>
                                    {item.materialSku}
                                  </td>
                                  <td className="py-1.5 px-2 text-text-secondary">
                                    {item.materialName || '—'}
                                  </td>
                                  <td className={`py-1.5 px-2 text-right mono font-bold text-accent ${isItemChecked ? 'text-success' : ''}`}>
                                    {item.quantity}u
                                  </td>
                                  <td className="py-1.5 px-2 text-text-secondary">
                                    <div className="flex flex-wrap gap-1">
                                      {item.allocations.map((a, aIdx) => (
                                        <span
                                          key={aIdx}
                                          className="mono text-[10px] px-1.5 py-0.2 rounded bg-bg-elevated border border-border-subtle text-text-primary"
                                        >
                                          {a.orderId} ({a.quantity}u)
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ==================== 2. SHORTAGES & UNCOVERED DEMAND ==================== */}
            {displayedPlan.shortages.length > 0 && (
              <div className="bg-bg-surface border border-crit/30 rounded-md overflow-hidden shadow-xs">
                <div className="p-3 px-4 border-b border-crit/20 bg-crit-dim flex items-center justify-between">
                  <div className="flex items-center gap-2 text-crit font-bold text-xs uppercase tracking-wider">
                    <AlertTriangle className="h-4 w-4" />
                    Shortages / Uncovered Material Demand ({displayedPlan.shortages.length} lines)
                  </div>
                  <span className="text-xs font-mono font-bold text-crit">
                    Total Deficit: {displayedPlan.summary.totalPiecesShortage} pieces
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-border-subtle bg-bg-subtle text-text-secondary text-[11px]">
                        <th className="p-2.5 px-3">Order ID</th>
                        <th className="p-2.5 px-3">Material SKU</th>
                        <th className="p-2.5 px-3">Item Description</th>
                        <th className="p-2.5 px-3 text-right">Requested</th>
                        <th className="p-2.5 px-3 text-right">Fulfilled</th>
                        <th className="p-2.5 px-3 text-right text-crit font-bold">Shortage</th>
                        <th className="p-2.5 px-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle font-mono text-[11px]">
                      {displayedPlan.shortages.map((s, idx) => (
                        <tr key={idx} className="hover:bg-bg-elevated/50">
                          <td className="p-2.5 px-3 font-semibold text-text-primary">{s.orderId}</td>
                          <td className="p-2.5 px-3 text-text-primary">{s.materialSku}</td>
                          <td className="p-2.5 px-3 font-sans text-text-secondary">{s.materialName || '—'}</td>
                          <td className="p-2.5 px-3 text-right">{s.requestedQuantity}u</td>
                          <td className="p-2.5 px-3 text-right">{s.fulfilledQuantity}u</td>
                          <td className="p-2.5 px-3 text-right text-crit font-bold">-{s.shortageQuantity}u</td>
                          <td className="p-2.5 px-3 font-sans text-text-muted text-[11px]">
                            {s.reason === 'NO_OBSERVATIONS'
                              ? 'No observations recorded for this SKU'
                              : 'Reported stock exhausted by prior orders'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ==================== 3. AGGREGATED DEMAND VS OBSERVATIONS ==================== */}
            <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden shadow-xs">
              <div className="p-3 px-4 border-b border-border-subtle bg-bg-elevated flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-accent" />
                    Consolidated Demand vs. Available Stock Observations
                  </h2>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Aggregated across all {displayedPlan.summary.totalOrdersSelected} selected orders. Multiple MUs and locations contribute separately.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-border-subtle bg-bg-subtle text-text-secondary text-[11px]">
                      <th className="p-2.5 px-3">Material SKU</th>
                      <th className="p-2.5 px-3">Description</th>
                      <th className="p-2.5 px-3 text-right">Total Demand</th>
                      <th className="p-2.5 px-3 text-right">Available Observed</th>
                      <th className="p-2.5 px-3 text-right">Allocated</th>
                      <th className="p-2.5 px-3 text-right">Shortage</th>
                      <th className="p-2.5 px-3">Contributing MUs & Locations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle font-mono text-[11px]">
                    {displayedPlan.aggregatedDemand.map((d, idx) => (
                      <tr key={idx} className="hover:bg-bg-elevated/50">
                        <td className="p-2.5 px-3 font-semibold text-text-primary">{d.materialSku}</td>
                        <td className="p-2.5 px-3 font-sans text-text-secondary">{d.materialName || '—'}</td>
                        <td className="p-2.5 px-3 text-right font-bold text-text-primary">{d.totalRequested}u</td>
                        <td className="p-2.5 px-3 text-right text-text-secondary">{d.availableObservedQuantity}u</td>
                        <td className="p-2.5 px-3 text-right text-accent font-bold">{d.totalAllocated}u</td>
                        <td className={`p-2.5 px-3 text-right font-bold ${d.totalShortage > 0 ? 'text-crit' : 'text-text-muted'}`}>
                          {d.totalShortage > 0 ? `-${d.totalShortage}u` : '0u'}
                        </td>
                        <td className="p-2.5 px-3 font-sans text-text-secondary">
                          <div className="flex flex-wrap gap-1">
                            {d.contributingMUs.map((mu, mIdx) => (
                              <span
                                key={mIdx}
                                className="mono text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated border border-border-subtle text-text-primary"
                              >
                                {mu !== 'Loose / None' ? `MU ${mu}` : 'Loose'}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: ORDERS MANAGEMENT ==================== */}
        {activeTab === 'orders' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Fulfillment Orders & Requirement Lines</h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Enter materials and quantities from checkout or customer bills. Multiple orders requiring the same material will share eligible stock observations.
                </p>
              </div>
              <button
                onClick={() => setOrderModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-xs transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Order</span>
              </button>
            </div>

            <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden shadow-xs">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border-subtle bg-bg-elevated text-text-secondary text-[11px] font-semibold">
                    <th className="p-3 w-10 text-center">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Priority</th>
                    <th className="p-3">Material Lines</th>
                    <th className="p-3 text-right">Total Units</th>
                    <th className="p-3">Created</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {state.orders.map(order => {
                    const isSelected = state.selectedOrderIds.includes(order.orderId);
                    const totalQty = order.lines.reduce((s, l) => s + l.requestedQuantity, 0);

                    return (
                      <tr
                        key={order.orderId}
                        className={`hover:bg-bg-elevated/60 transition ${
                          isSelected ? 'bg-accent-dim/20' : ''
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleOrder(order.orderId)}
                            className="rounded accent-accent h-4 w-4 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-mono font-bold text-text-primary text-sm">
                          {order.orderId}
                          {order.notes && (
                            <div className="text-[10px] font-sans font-normal text-text-muted mt-0.5">
                              {order.notes}
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-sans">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                            order.priority === 'HIGH'
                              ? 'bg-warn-dim text-warn border-warn/40'
                              : 'bg-bg-elevated text-text-secondary border-border-subtle'
                          }`}>
                            {order.priority || 'STANDARD'}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            {order.lines.map(line => (
                              <div key={line.lineId} className="flex items-center gap-2 text-[11px]">
                                <span className="mono font-semibold text-text-primary">{line.materialSku}</span>
                                <span className="text-text-muted">({line.materialName || 'Item'})</span>
                                <span className="mono font-bold text-accent ml-auto">{line.requestedQuantity}u</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-text-primary">
                          {totalQty}u
                        </td>
                        <td className="p-3 text-text-muted mono text-[11px]">
                          {formatAge(order.createdAt)}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteOrder(order.orderId)}
                            className="p-1 hover:text-crit text-text-muted transition"
                            title="Delete Order"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: STOCK OBSERVATIONS ==================== */}
        {activeTab === 'observations' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Current Stock Observations (By MU, Material & Location)</h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Snapshots transcribed from external &quot;Visualize Material&quot; views. Multiple SKUs can share the same MU tracking code.
                </p>
              </div>
              <button
                onClick={() => setObsModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-xs transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Record Stock Observation</span>
              </button>
            </div>

            <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden shadow-xs">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border-subtle bg-bg-elevated text-text-secondary text-[11px] font-semibold">
                    <th className="p-3">Container MU</th>
                    <th className="p-3">Material SKU</th>
                    <th className="p-3">Reported Location</th>
                    <th className="p-3 text-right">Observed Qty</th>
                    <th className="p-3">Recorded Age</th>
                    <th className="p-3">Notes</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {currentObservations.map(obs => {
                    const isStale = (Date.now() - obs.observedAt) > (staleThreshold * 60 * 1000);
                    return (
                      <tr key={obs.observationId} className="hover:bg-bg-elevated/60 transition">
                        <td className="p-3">
                          {obs.muId ? (
                            <span className="mono font-bold text-xs px-2 py-0.5 rounded bg-accent-dim text-accent border border-accent/30">
                              MU {obs.muId}
                            </span>
                          ) : (
                            <span className="text-[11px] text-text-muted italic">Loose / None</span>
                          )}
                        </td>
                        <td className="p-3 font-mono font-bold text-text-primary">
                          {obs.materialSku}
                        </td>
                        <td className="p-3">
                          {obs.location ? (
                            <span className="mono font-semibold px-2 py-0.5 rounded bg-bg-elevated border border-border-subtle text-text-primary">
                              {obs.location}
                            </span>
                          ) : (
                            <span className="text-warn text-[11px] italic bg-warn-dim px-2 py-0.5 rounded border border-warn/30">
                              Location unspecified
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-accent text-sm">
                          {obs.observedQuantity}u
                        </td>
                        <td className="p-3 text-[11px] mono">
                          {isStale ? (
                            <span className="text-warn font-semibold flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatAge(obs.observedAt)} (Stale)
                            </span>
                          ) : (
                            <span className="text-text-muted">
                              {formatAge(obs.observedAt)}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-text-secondary text-[11px]">
                          {obs.notes || '—'}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              setNewObsSku(obs.materialSku);
                              setNewObsMuId(obs.muId || '');
                              setNewObsLocation(obs.location || '');
                              setNewObsQty(obs.observedQuantity);
                              setObsModalOpen(true);
                            }}
                            className="text-accent hover:underline text-xs mr-3 font-medium"
                          >
                            Refresh
                          </button>
                          <button
                            onClick={() => handleDeleteObservation(obs.observationId)}
                            className="p-1 hover:text-crit text-text-muted transition"
                            title="Delete Observation"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== TAB 4: PLANNING RUNS HISTORY ==================== */}
        {activeTab === 'history' && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Historical Planning Runs (Audit Log)</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Every calculation captures an immutable snapshot of selected orders and active observations. Historical results are never altered when observations are refreshed.
              </p>
            </div>

            <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden shadow-xs">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border-subtle bg-bg-elevated text-text-secondary text-[11px] font-semibold">
                    <th className="p-3">Run ID</th>
                    <th className="p-3">Calculated Time</th>
                    <th className="p-3">Physical MUs</th>
                    <th className="p-3">Allocated Pieces</th>
                    <th className="p-3">Shortage</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {state.history.map(run => (
                    <tr key={run.runId} className="hover:bg-bg-elevated/60 transition">
                      <td className="p-3 mono font-bold text-accent">
                        {run.runId}
                      </td>
                      <td className="p-3 text-text-muted mono text-[11px]">
                        {new Date(run.calculatedAt).toLocaleString()} ({formatAge(run.calculatedAt)})
                      </td>
                      <td className="p-3 mono font-bold text-text-primary">
                        {run.summary.totalManipulationUnitsToCollect} MUs
                      </td>
                      <td className="p-3 mono font-bold text-text-primary">
                        {run.summary.totalPiecesAllocated}u
                      </td>
                      <td className={`p-3 mono font-bold ${run.summary.totalPiecesShortage > 0 ? 'text-crit' : 'text-text-muted'}`}>
                        {run.summary.totalPiecesShortage > 0 ? `-${run.summary.totalPiecesShortage}u` : '0u'}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedHistoricalRun(run);
                            setActiveTab('plan');
                          }}
                          className="px-2.5 py-1 rounded bg-bg-elevated border border-border-subtle hover:border-accent text-accent font-semibold text-xs transition"
                        >
                          Inspect Snapshot ›
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ==================== CREATE ORDER MODAL ==================== */}
      {orderModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg bg-bg-surface border border-border-strong rounded-lg shadow-xl overflow-hidden flex flex-col">
            <div className="p-3.5 px-4 border-b border-border-subtle bg-bg-elevated flex items-center justify-between">
              <h3 className="font-semibold text-sm text-text-primary">Create Fulfillment Order</h3>
              <button onClick={() => setOrderModalOpen(false)} className="text-text-muted hover:text-text-primary">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">
                    Order ID (from checkout) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrderId}
                    onChange={e => setNewOrderId(e.target.value)}
                    placeholder="e.g. 000815299"
                    className="w-full bg-bg-elevated border border-border-subtle rounded px-2.5 py-1.5 mono text-text-primary outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">
                    Priority Tier
                  </label>
                  <select
                    value={newOrderPriority}
                    onChange={e => setNewOrderPriority(e.target.value as any)}
                    className="w-full bg-bg-elevated border border-border-subtle rounded px-2.5 py-1.5 text-text-primary outline-none focus:border-accent"
                  >
                    <option value="STANDARD">STANDARD</option>
                    <option value="HIGH">HIGH (Urgent SLA)</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">
                  Order Notes / External Reference
                </label>
                <input
                  type="text"
                  value={newOrderNotes}
                  onChange={e => setNewOrderNotes(e.target.value)}
                  placeholder="e.g. Customer billing reference, rush handling"
                  className="w-full bg-bg-elevated border border-border-subtle rounded px-2.5 py-1.5 text-text-primary outline-none focus:border-accent"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-medium text-text-secondary">
                    Material Requirement Lines *
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewOrderLines(prev => [...prev, { sku: '', name: '', qty: 1 }])}
                    className="text-accent hover:underline text-[11px] font-semibold"
                  >
                    + Add Another Line
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto border border-border-subtle rounded p-2 bg-bg-elevated">
                  {newOrderLines.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        list="known-skus"
                        value={line.sku}
                        onChange={e => {
                          const skuVal = e.target.value;
                          const match = knownMaterials.find(m => m.sku === skuVal);
                          setNewOrderLines(prev => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], sku: skuVal, name: match ? match.name : copy[idx].name };
                            return copy;
                          });
                        }}
                        placeholder="Material SKU"
                        className="flex-1 bg-bg-surface border border-border-subtle rounded px-2 py-1 mono text-text-primary text-xs"
                      />
                      <input
                        type="text"
                        value={line.name}
                        onChange={e => {
                          const nameVal = e.target.value;
                          setNewOrderLines(prev => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], name: nameVal };
                            return copy;
                          });
                        }}
                        placeholder="Description (optional)"
                        className="flex-1 bg-bg-surface border border-border-subtle rounded px-2 py-1 text-text-primary text-xs"
                      />
                      <input
                        type="number"
                        min={1}
                        required
                        value={line.qty}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10) || 1;
                          setNewOrderLines(prev => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], qty: val };
                            return copy;
                          });
                        }}
                        className="w-16 bg-bg-surface border border-border-subtle rounded px-2 py-1 mono text-text-primary text-xs text-right"
                      />
                      {newOrderLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setNewOrderLines(prev => prev.filter((_, i) => i !== idx))}
                          className="text-text-muted hover:text-crit p-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <datalist id="known-skus">
                  {knownMaterials.map(m => (
                    <option key={m.sku} value={m.sku}>{m.name}</option>
                  ))}
                </datalist>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setOrderModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-border-subtle text-text-secondary hover:bg-bg-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-accent hover:bg-accent-hover text-white font-semibold transition"
                >
                  Save Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== RECORD OBSERVATION MODAL ==================== */}
      {obsModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-bg-surface border border-border-strong rounded-lg shadow-xl overflow-hidden flex flex-col">
            <div className="p-3.5 px-4 border-b border-border-subtle bg-bg-elevated flex items-center justify-between">
              <h3 className="font-semibold text-sm text-text-primary">Record Stock Observation</h3>
              <button onClick={() => setObsModalOpen(false)} className="text-text-muted hover:text-text-primary">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveObservation} className="p-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">
                    MU / Box Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={newObsMuId}
                    onChange={e => setNewObsMuId(e.target.value)}
                    placeholder="e.g. 502900 (or blank)"
                    className="w-full bg-bg-elevated border border-border-subtle rounded px-2.5 py-1.5 mono text-text-primary outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">
                    Location (Optional)
                  </label>
                  <input
                    type="text"
                    value={newObsLocation}
                    onChange={e => setNewObsLocation(e.target.value)}
                    placeholder="e.g. EC07A (or blank)"
                    className="w-full bg-bg-elevated border border-border-subtle rounded px-2.5 py-1.5 mono text-text-primary outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">
                  Material SKU *
                </label>
                <input
                  type="text"
                  required
                  list="known-skus-obs"
                  value={newObsSku}
                  onChange={e => setNewObsSku(e.target.value)}
                  placeholder="e.g. 1524289001"
                  className="w-full bg-bg-elevated border border-border-subtle rounded px-2.5 py-1.5 mono text-text-primary outline-none focus:border-accent"
                />
                <datalist id="known-skus-obs">
                  {knownMaterials.map(m => (
                    <option key={m.sku} value={m.sku}>{m.name}</option>
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">
                  Observed Quantity *
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={newObsQty}
                  onChange={e => setNewObsQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-bg-elevated border border-border-subtle rounded px-2.5 py-1.5 mono text-text-primary outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">
                  Observation Source / Notes
                </label>
                <input
                  type="text"
                  value={newObsNotes}
                  onChange={e => setNewObsNotes(e.target.value)}
                  placeholder="e.g. Checked front display tier, reported in checkout system"
                  className="w-full bg-bg-elevated border border-border-subtle rounded px-2.5 py-1.5 text-text-primary outline-none focus:border-accent"
                />
              </div>

              <div className="p-2.5 rounded bg-bg-elevated text-[11px] text-text-muted leading-relaxed">
                <span className="font-semibold text-text-secondary">Deduplication Rule:</span> A new observation for the same MU and SKU updates that item&apos;s count without affecting other materials in the same container.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setObsModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-border-subtle text-text-secondary hover:bg-bg-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-accent hover:bg-accent-hover text-white font-semibold transition"
                >
                  Save Observation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
