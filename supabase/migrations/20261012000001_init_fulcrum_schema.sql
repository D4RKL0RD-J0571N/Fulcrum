-- ============================================================================
-- Migration: 20261012000001_init_fulcrum_schema.sql
-- Description: Core multi-tenant warehouse topography, append-only ledger,
--              reservations, orders, and simulation run tables with RLS.
-- ============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Workspaces & Roles
CREATE TABLE IF NOT EXISTS public.workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'planner', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(workspace_id, user_id)
);

-- 3. Versioned Warehouse Layouts
CREATE TABLE IF NOT EXISTS public.warehouse_layouts (
    id TEXT NOT NULL,
    version INTEGER NOT NULL,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    config JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    PRIMARY KEY (id, version)
);

-- 4. Dynamic Locations (Generated from Layout Versions)
CREATE TABLE IF NOT EXISTS public.locations (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    layout_id TEXT NOT NULL,
    layout_version INTEGER NOT NULL,
    code TEXT NOT NULL,
    side TEXT,
    row TEXT NOT NULL,
    bay INTEGER NOT NULL,
    level TEXT NOT NULL,
    x NUMERIC(8, 2) NOT NULL,
    y NUMERIC(8, 2) NOT NULL,
    z NUMERIC(8, 2) NOT NULL,
    access_type TEXT NOT NULL CHECK (access_type IN ('manual', 'forklift', 'any')),
    max_platforms INTEGER NOT NULL DEFAULT 2,
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    FOREIGN KEY (layout_id, layout_version) REFERENCES public.warehouse_layouts(id, version) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_locations_workspace_code ON public.locations(workspace_id, code);
CREATE INDEX IF NOT EXISTS idx_locations_coords ON public.locations(workspace_id, row, bay, level);

-- 5. Platforms & Manipulation Units (MUs)
CREATE TABLE IF NOT EXISTS public.platforms (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    location_id TEXT NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    position_index INTEGER NOT NULL CHECK (position_index BETWEEN 1 AND 2),
    max_mu_capacity INTEGER NOT NULL DEFAULT 9,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (location_id, position_index)
);

CREATE TABLE IF NOT EXISTS public.manipulation_units (
    id TEXT PRIMARY KEY, -- 6-digit numeric (e.g. '502900')
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    platform_id TEXT REFERENCES public.platforms(id) ON DELETE SET NULL,
    slot_index INTEGER CHECK (slot_index BETWEEN 1 AND 9),
    status TEXT NOT NULL CHECK (status IN ('active', 'in_transit', 'unplaced', 'blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_mu_workspace_platform ON public.manipulation_units(workspace_id, platform_id);

-- 6. Append-Only Inventory Ledger (Stock Movements)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    movement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    idempotency_key TEXT NOT NULL,
    movement_timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    virtual_timestamp INTEGER, -- optional virtual time for simulations
    movement_type TEXT NOT NULL CHECK (movement_type IN ('RECEIPT', 'TRANSFER', 'PICK', 'REPLENISHMENT', 'ADJUSTMENT')),
    from_location_id TEXT REFERENCES public.locations(id),
    to_location_id TEXT REFERENCES public.locations(id),
    from_mu_id TEXT REFERENCES public.manipulation_units(id),
    to_mu_id TEXT REFERENCES public.manipulation_units(id),
    sku TEXT NOT NULL,
    parent_sku TEXT,
    quantity_units INTEGER NOT NULL CHECK (quantity_units > 0),
    lot_number TEXT,
    operator_id TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_sku ON public.stock_movements(workspace_id, sku);
CREATE INDEX IF NOT EXISTS idx_stock_movements_mu ON public.stock_movements(workspace_id, to_mu_id);

-- 7. Stock Reservations (Atomic allocation against unreserved balance)
CREATE TABLE IF NOT EXISTS public.stock_reservations (
    reservation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL,
    line_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    quantity_units INTEGER NOT NULL CHECK (quantity_units > 0),
    mu_id TEXT NOT NULL REFERENCES public.manipulation_units(id),
    location_id TEXT NOT NULL REFERENCES public.locations(id),
    status TEXT NOT NULL CHECK (status IN ('RESERVED', 'COMMITTED', 'RELEASED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_reservations_workspace_sku_mu ON public.stock_reservations(workspace_id, sku, mu_id);

-- 8. Orders & Line Items
CREATE TABLE IF NOT EXISTS public.orders (
    order_id TEXT PRIMARY KEY, -- 9-digit zero padded (e.g. '000815296')
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    priority TEXT NOT NULL CHECK (priority IN ('CRITICAL', 'HIGH', 'STANDARD', 'LOW')),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'ALLOCATED', 'PICKING', 'PACKED', 'DISPATCHED', 'CANCELLED')),
    arrival_time TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    deadline TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.order_line_items (
    line_id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    quantity_units INTEGER NOT NULL CHECK (quantity_units > 0)
);

-- 9. Postgres Simulation Job Queue (Phase B Worker Queue)
CREATE TABLE IF NOT EXISTS public.simulation_runs (
    run_id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    snapshot_hash TEXT NOT NULL,
    strategy TEXT NOT NULL CHECK (strategy IN ('BASELINE', 'CONGESTION_AWARE', 'BATCH_WAVE_ROUTING')),
    seed INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
    input_payload JSONB NOT NULL,
    output_payload JSONB,
    worker_node_id TEXT,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sim_runs_queue ON public.simulation_runs(status, queued_at) WHERE status = 'queued';

-- ============================================================================
-- 10. REAL-TIME PROJECTIONS (Materialized / Computed View)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_current_stock_balance AS
WITH on_hand AS (
    SELECT
        workspace_id,
        sku,
        to_mu_id AS mu_id,
        to_location_id AS location_id,
        SUM(
            CASE 
                WHEN movement_type IN ('RECEIPT', 'REPLENISHMENT', 'ADJUSTMENT') THEN quantity_units
                WHEN movement_type = 'PICK' THEN -quantity_units
                ELSE 0
            END
        ) AS on_hand_units
    FROM public.stock_movements
    WHERE to_mu_id IS NOT NULL
    GROUP BY workspace_id, sku, to_mu_id, to_location_id
),
reserved AS (
    SELECT
        workspace_id,
        sku,
        mu_id,
        SUM(quantity_units) AS reserved_units
    FROM public.stock_reservations
    WHERE status = 'RESERVED'
    GROUP BY workspace_id, sku, mu_id
)
SELECT
    o.workspace_id,
    o.sku,
    o.mu_id,
    o.location_id,
    GREATEST(0, o.on_hand_units) AS on_hand_units,
    COALESCE(r.reserved_units, 0) AS reserved_units,
    GREATEST(0, o.on_hand_units - COALESCE(r.reserved_units, 0)) AS available_units
FROM on_hand o
LEFT JOIN reserved r 
    ON o.workspace_id = r.workspace_id 
   AND o.sku = r.sku 
   AND o.mu_id = r.mu_id;

-- ============================================================================
-- 11. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manipulation_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_runs ENABLE ROW LEVEL SECURITY;

-- Helper function: Get workspace claim from JWT
CREATE OR REPLACE FUNCTION public.current_workspace_id() 
RETURNS TEXT AS $$
    SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'workspace_id', '')::TEXT;
$$ LANGUAGE SQL STABLE;

-- Tenant Isolation Policies
CREATE POLICY workspace_isolation_layouts ON public.warehouse_layouts
    FOR ALL USING (workspace_id = public.current_workspace_id() OR public.current_workspace_id() IS NULL);

CREATE POLICY workspace_isolation_locations ON public.locations
    FOR ALL USING (workspace_id = public.current_workspace_id() OR public.current_workspace_id() IS NULL);

CREATE POLICY workspace_isolation_platforms ON public.platforms
    FOR ALL USING (workspace_id = public.current_workspace_id() OR public.current_workspace_id() IS NULL);

CREATE POLICY workspace_isolation_mus ON public.manipulation_units
    FOR ALL USING (workspace_id = public.current_workspace_id() OR public.current_workspace_id() IS NULL);

CREATE POLICY workspace_isolation_movements ON public.stock_movements
    FOR ALL USING (workspace_id = public.current_workspace_id() OR public.current_workspace_id() IS NULL);

CREATE POLICY workspace_isolation_reservations ON public.stock_reservations
    FOR ALL USING (workspace_id = public.current_workspace_id() OR public.current_workspace_id() IS NULL);

CREATE POLICY workspace_isolation_orders ON public.orders
    FOR ALL USING (workspace_id = public.current_workspace_id() OR public.current_workspace_id() IS NULL);

CREATE POLICY workspace_isolation_runs ON public.simulation_runs
    FOR ALL USING (workspace_id = public.current_workspace_id() OR public.current_workspace_id() IS NULL);
