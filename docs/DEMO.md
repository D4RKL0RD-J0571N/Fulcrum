# Fulcrum — Live Showcase Demo Script (Phase A)

This script outlines the exact live demonstration sequence for company leadership and operations planners.
The showcase is 100% deterministic, offline-capable, and grounded in real synthetic fulfillment telemetry without fabricated numbers.

---

## 1. Demo Objectives & Key Takeaways
1. **Showcase Modern High-Density Control Tower UX:** Dark navy canvas, tabular numerals, 1px subtle separation, and decoupled selection states.
2. **Explain the Bottleneck:** Discrete picking causing repetitive visits to the same Manipulation Unit (MU) and contention between upper-tier forklifts and ground-tier pickers.
3. **Prove Quantified Optimization:** Demonstrate deterministic simulation side-by-side with genuine calculated metric improvements.
4. **Governed AI Workflow:** Walk through the complete lifecycle (`Proposed -> Reviewed -> Simulated -> Approved -> Committed`) backed by entity-level verifiable evidence citations.

---

## 2. Step-by-Step Live Walkthrough (3–5 Minutes)

### Step 1: The Operational Dashboard & 2D Plan View
- **Action:** Open `http://localhost:3000`.
- **Narration:**
  > *"Fulcrum is a simulation-first optimization platform designed for modern high-velocity fulfillment centers. We are currently viewing warehouse `WH-01` in Zone E with over 2,000 addressable storage locations across Rows A to Z."*
- **Visual Points:**
  - Note the pulsing synchronization indicator (`Synced 42s ago`).
  - Point to the KPI strip: real numbers dynamically derived from the active snapshot (1,842 pending orders, 78 at risk, throughput of 340 orders/h).

### Step 2: The Core Problem — Redundant MU Trips & Level A Platform Extraction
- **Action:** In the Fulfillment Queue, click on order `000815296`, then inspect order `000815297`.
- **Narration:**
  > *"Notice orders `000815296` and `000815297`. Both request single units from parent SKU `1524289` (Athletic Tee Slim in sizes S and M). These size variants are stored together in mixed Manipulation Unit `502900` at bay `EH14`, Level A.*
  > *In traditional discrete picking, an operator walks across the facility to bay EH14, manually pulls out the heavy ground-level cage, picks 1 piece, walks back to the packing station, and then is immediately dispatched to walk right back to EH14 to pull the exact same cage for the next order. That's 42 wasted trips and 44 redundant cage extractions every shift."*

### Step 3: Global 6-Digit MU Search & Multi-Level Rack Inspection
- **Action:** Click the global search bar, type `502900`, and hit Enter.
- **Narration:**
  > *"Because Fulcrum tracks inventory by both spatial location and 6-digit MU number, searching for box `502900` instantly highlights its exact rack bay `EH14` on the map and opens the vertical rack elevation drawer."*
- **Visual Points:**
  - Show the **"Boxes / MUs in this rack position"** card: displays the 6-digit boxes currently occupying the bay across tiers (`L1: 502900`, `L4: 101003`).
  - Expand **Platform 1**: point out that each rack level holds 2 platforms with up to 9 boxes each (18 boxes per tier), containing mixed packs of 5 to 6 units per sequential variant.

### Step 4: AI Operations Assistant & Verifiable Evidence
- **Action:** Scroll to the bottom right AI panel. Click the evidence chip `502900` or `EH14D`.
- **Narration:**
  > *"Our AI assistant operates under strict governance. It never hallucinates ungrounded statistics. Every observation includes verifiable evidence chips. Clicking `502900` or `ORD-8812` links directly to the physical storage platform and queued order."*

### Step 5: Side-by-Side Simulation & Plan Approval
- **Action:** Click the **[Review Plan]** button.
- **Narration:**
  > *"The model proposes Batch-Wave Proposal 4a: deferring the high-tier forklift replenishment outside the manual pick window and consolidating visits to box `502900` into a single batch pick."*
- **Action:** In the modal, check the acknowledgement checkbox and click **[Approve]**.
- **Action:** Click the **[Simulate]** button. Observe the loading skeleton for 1.4 seconds, followed by the verified run result (`SIM-2042`, seed 50617).
- **Narration:**
  > *"The simulation engine runs deterministically against the golden snapshot. We achieve a 33.5% reduction in picking travel distance, eliminate all 42 redundant MU trips, and recover 75 minutes of cycle time."*

---

## 3. Demo Troubleshooting & Resets
- If you need to reset the scenario to the baseline state at any point during a demo, simply reload the page or click any location on the map to restore the initial selection state.
