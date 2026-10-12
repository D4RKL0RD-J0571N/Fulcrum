# Fulcrum — AI Integration & Security Architecture

## 1. Principles of AI Integration in Fulcrum

Fulcrum uses AI as an operational decision aid, not an autonomous agent.
The architecture enforces three cardinal rules:
1. **Zero Direct Mutation:** AI models never mutate database tables, inventory ledgers, or execution queues directly.
2. **Deterministic Verification:** Every AI-generated optimization plan must be validated by the deterministic simulation engine before it can be approved.
3. **Traceable Evidence:** AI explanations must ground claims in concrete database entities (location codes, MU IDs, order IDs, simulation run IDs). Hallucinations are systematically blocked by schema validation.

---

## 2. AI Provider Abstraction

The AI integration lives behind a strict provider interface:

```typescript
export interface AiProvider {
  name: string;
  generatePlanExplanation(context: SimulationComparisonContext): Promise<PlanExplanationResult>;
  analyzeBottlenecks(context: WarehouseBottleneckContext): Promise<BottleneckAnalysisResult>;
}
```

### Mock Provider Implementation (Phase A Showcase)
In Phase A, a deterministic `MockAiProvider` is implemented:
- Operates offline with zero external network calls or API keys required.
- Inspects real simulation result diffs (e.g. baseline vs. congestion-aware run).
- Dynamically generates factual summaries quoting the exact metrics, affected bays, and MU IDs.
- Guarantees the application remains 100% functional without an active LLM subscription.

---

## 3. Tool Sandboxing & Segregation

AI tools are partitioned into two strict categories:

### 3.1 Read-Only Query Tools
- `get_location_occupancy(location_code: string)`
- `get_bay_congestion_history(row: string, column: number)`
- `get_order_deadline_risk(order_id: string)`
- `list_active_reservations(sku: string)`

### 3.2 Plan Proposal Tools (Write-Constrained)
- `propose_task_reschedule(task_id: string, new_start_time: number, reason: string)`
- `propose_mu_relocation(mu_id: string, target_location: string, reason: string)`

*Note: Proposal tools only append suggestions to a pending `PlanProposal` object. They cannot commit transactions.*

---

## 4. Plan Lifecycle & State Transitions

```
[ AI Generates Proposal ]
           |
           v
      [ Proposed ]  <-- Tied to Snapshot SHA-256
           |
           +---> [ Rejected ] (Operator Declines)
           |
           v
      [ Reviewed ] (Operator Validates Affected Entities)
           |
           v
     [ Simulated ] (Engine Runs Alternative Against Snapshot)
           |
           +---> [ Expired ] (Operational State Changed)
           |
           v
      [ Approved ] (Operator Confirms Quantified Improvements)
           |
           v
     [ Committed ] (Ledger Movements Appended Atomically)
```

---

## 5. Security & Multi-Tenant Isolation

### 5.1 No Service Role Keys in Client
- The browser client connects only via user-scoped sessions.
- In Phase B (Supabase), all database queries are subject to Row-Level Security (RLS) enforcing `workspace_id = current_setting('request.jwt.claims')::json->>'workspace_id'`.

### 5.2 Role-Based Access Control (RBAC)
- `admin`: Can modify layout configurations, approve warehouse migrations, manage workspace members.
- `planner`: Can initiate simulation runs, propose plans, review plans, and approve plans.
- `viewer`: Read-only access to maps, orders, stock projections, and simulation reports.

### 5.3 Secret Management & Environment Hygiene
- No secrets stored in git.
- `.env.example` committed with blank/dummy keys.
- Application validates required environment variables at boot using a Zod configuration schema.
