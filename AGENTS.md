# Standing Rules for AI Agents — Fulcrum

These standing rules persist across sessions and development iterations for the **Fulcrum** project.

---

## 0. Working Agreement and Phasing

The project has two phases:
- **Phase A: Showcase slice (M1-M5).** A polished, reliable, locally runnable demo built on synthetic data, with a real deterministic simulation and a user-configurable warehouse layout. Optimized for a live demo to company leadership: it must not break, and no number may be fabricated.
- **Phase B: Production foundation (M6+).** Supabase persistence with auth/RLS, the C# simulation worker, background jobs, performance reports, and integrations.

### Standing Execution Rules
1. **Strict Milestone Phasing:** Execute milestones in order. Do not start one before the previous passes its exit criteria.
2. **Milestone Scoping:** Work only on the milestone given in each request. Do not run ahead.
3. **Milestone Reporting:** After each milestone report:
   - What was done
   - What was verified (exact commands and results)
   - Assumptions made
   - Risks identified
   - The exact next step
4. **Honesty and Verification:** Never claim a feature is complete unless it is implemented AND verified.
5. **Handling Ambiguity:** If a requirement is ambiguous, record it in `docs/OPEN_QUESTIONS.md`, choose the most conservative assumption, and continue. Do not invent real company requirements.
6. **Repository Hygiene:** Inspect the repository before editing. Do not overwrite unrelated work. Do not add dependencies without justification.
7. **Synthetic Data Exclusivity:** Use synthetic data exclusively. Never connect to real company systems or use confidential data.

---

## 3. Architecture Principles

Clean architecture with pragmatic DDD. Keep distinct:
- `domain`
- `application` (use cases)
- `persistence` / `adapters`
- `simulation` / `optimization`
- `ai` integration
- `web` presentation

### Boundary Rules
- **Pure Domain:** The domain depends on NO React, Next.js, Supabase SDK, LLM provider, or infrastructure code.
- **Explicit Domain Models & Contracts:** Strongly typed contracts. Data-driven configuration only where policies genuinely need to be extensible. No unnecessary generic frameworks.
- **State Transitions:** Important changes are explicit, validated state transitions.
- **Repository Interfaces:** The application layer talks to repository interfaces. Phase A ships an in-memory, deterministically seeded adapter. Phase B adds a Supabase/Postgres adapter behind the same interfaces. Do not leak adapter details into use cases.
- **Multi-Tenancy from Day One:** Every entity carries `workspace_id`. Phase A uses a single seeded workspace (`ws_default`), but all queries are workspace-scoped. Roles: `admin`, `planner`, `viewer`.
- **Inventory as an Append-Only Ledger:** Stock movements are immutable entries with idempotency keys. Current stock per MU/location is a projection. Reservations are explicit records created atomically against available quantity.
- **Layout Engine Boundary:** The layout engine (parse/format/validate) lives only on the web/application side. The simulation engine **NEVER** parses location codes. When a run starts, the application sends a resolved snapshot: each location as an ID with coordinates (x/y/z), access type, capacity, and blocked status.
- **Simulation Engine Boundary:** The simulation engine is an independent package with a versioned input/output contract (Zod schemas in Phase A). It runs without the web UI, a database, or an LLM. It has no dependency on location code strings.

---

## 4. Technology Stack & Determinism Rules

### Web Stack
- Next.js App Router, TypeScript (strict), React, Tailwind CSS, shadcn/ui with Radix primitives, Recharts, Zod, Vitest, Playwright, fast-check.
- Server Components by default; Client Components only where interaction requires them.
- Warehouse view: data-driven SVG or Canvas; no WebGL/3D in the first version.

### Simulation Stack
- **Phase A:** TypeScript package (`packages/sim-engine`) behind the versioned contract. Temporary adapter documented in ADR-001.
- **Phase B:** C#/.NET deterministic engine and ASP.NET Core worker in Docker, replacing the TypeScript engine against the same contract and golden test fixtures. Do NOT maintain two independent implementations long-term.

### Strict Determinism Rules
- **Integer Virtual Time:** Virtual time is measured in integer seconds; never floats or real-time sleeps.
- **Deterministic PRNG:** Seeded PRNG inside the engine (PCG or xoshiro), never language built-ins like `Math.random()`.
- **Deterministic Tie-Breaking:** Ties between simultaneous events broken by fixed keys: `(time, event_type, entity_id)`.
- **Content Hashing:** Each run references an immutable input snapshot with a SHA-256 content hash, engine version, ruleset version, and seed.
- **Golden-File Fixtures:** Same input + seed produces byte-identical output across runs and languages.

---

## 10. Engineering Workflow

- **Small, Coherent Increments:** After each increment, run format, lint, type check, tests, and build. Fix regressions before moving on.
- **No Secrets in Source Control:** Provide `.env.example` without credentials; validate environment at startup using Zod.
- **Database Migrations:** Schema changes only via versioned SQL migrations (Phase B).
- **Deterministic Seed Data:** Keep generated seed data reproducible across environments.
- **Code Style Alignment:** Follow Jostin's development style: clarity, modularity, explicit logic, strict separation of concerns.
