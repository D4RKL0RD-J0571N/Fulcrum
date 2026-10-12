# Fulcrum — Design System & Visual Specification

## 1. Visual Language & Principles

Fulcrum is a high-density, mission-critical operations control tower inspired by Linear, modern developer observability tools, and industrial SCADA platforms.

### Key Guidelines
- **Dark, Focused Canvas:** Deep navy / charcoal surfaces with subtle 1px border separation. Minimizes eye fatigue in continuous operations.
- **Monospace Precision:** All location codes (`EH14D`), MU tags (`MU-8021`), SKUs, quantities, and timing metrics use tabular numerals (`font-mono`).
- **Purposeful Color:** Color communicates status, constraint, and data origin—never decorative aesthetics.
- **Color + Icon/Pattern:** Color is never the sole differentiator; badges and indicators incorporate shape, pattern, or icon markers for accessibility.

---

## 2. Color Palette & Tokens

### 2.1 Base Theme (Dark Navy / Neutral Slate)
- `bg-canvas`: `#0A0D14` (Deep obsidian/navy background)
- `bg-surface`: `#111622` (Card and panel surface)
- `bg-surface-elevated`: `#182030` (Modals, drawers, tooltips)
- `border-subtle`: `#1E293B` (1px subtle border)
- `border-active`: `#334155` (Active / focused borders)
- `text-primary`: `#F8FAFC` (Slate 50)
- `text-secondary`: `#94A3B8` (Slate 400)
- `text-muted`: `#64748B` (Slate 500)

### 2.2 Functional Accents
- **Teal / Cyan (`#06B6D4` / `#0891B2`):** Live operational state, active pickers, on-schedule tasks.
- **Amber / Orange (`#F59E0B` / `#D97706`):** Bottlenecks, congestion, waiting tasks, items awaiting approval.
- **Red (`#EF4444`):** Critical events only: stock shortages, breached deadlines, unplaced units.
- **Purple / Indigo (`#8B5CF6` / `#6366F1`):** AI-generated recommendations, synthetic plans, optimization proposals.

---

## 3. Four Data Types — Four Visual Treatments

Fulcrum explicitly distinguishes data lineage across the UI:

| Data Type | Definition | Surface & Border | Marker / Label | Interactive Affordance |
|---|---|---|---|---|
| **Live** | Real synchronized operational state | Solid slate surface (`bg-surface`), solid subtle border | Solid Teal pill with pulse dot: `LIVE` + freshness timestamp | Real-time inspection, inventory drawer drill-down |
| **Simulated** | Projected outcome from simulation run | Subtle hatch pattern or dashed border (`border-dashed border-cyan-500/40`) | Cyan outlined pill: `SIMULATED` + run ID (`#9942`) + seed | Comparison against live baseline, run selector |
| **AI-Generated** | Explanation or suggested triage from model | Soft purple ambient glow (`bg-purple-950/20 border-purple-800/40`) | Purple badge: `AI INSIGHT` with spark icon | Expandable evidence citations linking to map/orders |
| **Proposed** | Planned modification awaiting authorization | Amber border (`border-amber-500/50 bg-amber-950/20`) | Amber badge: `AWAITING APPROVAL` | Action buttons: `[Review Plan]`, `[Simulate]`, `[Approve]` |

---

## 4. Component Inventory

1. **Top Bar:**
   - Workspace selector (`ws_default`).
   - Freshness badge (`Synced 42s ago` with polling refresh button).
   - Global search input (autocomplete for Location Code, SKU, Order ID, MU ID).
   - Notifications drawer trigger.
   - User profile & workspace role (`Planner`).
2. **Left Navigation Rail:**
   - Nav items: Overview, Orders, Inventory, Fulfillment, Simulation Lab, Optimization, Analytics, Data Sources, Settings.
3. **KPI Strip:**
   - Total Locations, MU Capacity Utilization, Active Orders, Bottleneck Count, On-Time Fulfillment Rate.
4. **Interactive Warehouse Map (Top-Down Plan View):**
   - Racks displayed as parallel horizontal or vertical strips.
   - Bays rendered as cells along each row with heat fill (congestion, occupancy, pick velocity).
   - Selection outline (ring indicator) completely decoupled from status fill color.
   - Heatmap mode switcher: `Occupancy | Congestion | Pick Activity | Access Type`.
5. **Location Detail Drawer (Right Side):**
   - Rack elevation drill-down (vertical level stack from top to bottom).
   - Level indicator showing access type (`[M]` Manual vs `[F]` Forklift).
   - Platform slots with loaded MUs, SKUs, and lot numbers.
6. **Bottom Split Panel:**
   - **Left:** Fulfillment task queue with status pills.
   - **Center:** Optimization strategy comparison matrix (Baseline vs. Congestion-Aware metrics with calculated $\Delta$).
   - **Right:** AI Assistant / Governance panel with structured tabs: Observation, Evidence Citations, Proposed Plan.

---

## 5. UI States & Fallbacks

- **Empty State (No Layout):** Explanatory banner with CTA: "Configure Warehouse Layout" guiding to the setup wizard.
- **Loading Skeleton:** High-contrast pulsing gray skeleton keeping exact layout geometry to prevent layout shift.
- **Stale State:** Yellow warning ribbon: "Data feed stale (> 5m since last sync). Showing cached snapshot."
- **Error State:** In-card retryable error boundary displaying correlation ID.
