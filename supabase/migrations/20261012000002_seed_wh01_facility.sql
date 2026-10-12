-- ============================================================================
-- Seed: 20261012000002_seed_wh01_facility.sql
-- Description: Deterministic seed for WH-01 Global Fulfillment (Zone E)
-- ============================================================================

INSERT INTO public.workspaces (id, name)
VALUES ('ws_default', 'Global Fulfillment WH-01')
ON CONFLICT (id) DO NOTHING;

-- Layout v3 for WH-01
INSERT INTO public.warehouse_layouts (id, version, workspace_id, name, config)
VALUES (
    'layout_wh01',
    3,
    'ws_default',
    'Global Fulfillment Zone E (E-commerce)',
    '{
        "prefixEnabled": true,
        "sides": [{"code": "E", "label": "E-commerce"}],
        "rowType": "alpha",
        "rowStart": "A",
        "rowCount": 26,
        "defaultBaysPerRow": 20,
        "bayOverrides": { "H": 14, "Q": 18, "W": 16 },
        "bayPadding": 2,
        "rowPadding": 0,
        "levels": [
            { "code": "A", "label": "Bottom", "accessType": "manual", "heightMeters": 0.5 },
            { "code": "B", "label": "Mid", "accessType": "manual", "heightMeters": 2.0 },
            { "code": "C", "label": "Top (manual)", "accessType": "manual", "heightMeters": 3.5 },
            { "code": "D", "label": "Forklift only", "accessType": "forklift", "heightMeters": 5.5 }
        ],
        "separator": "",
        "defaultPlatformsPerLocation": 2,
        "defaultPlatformCapacityUnits": 18,
        "bayWidthMeters": 1.2,
        "levelHeightMeters": 1.5,
        "aisleWidthMeters": 2.5
    }'::jsonb
)
ON CONFLICT (id, version) DO NOTHING;

-- Seed key locations: EH14A, EH14D, EC07A
INSERT INTO public.locations (id, workspace_id, layout_id, layout_version, code, side, row, bay, level, x, y, z, access_type, max_platforms, is_blocked)
VALUES
    ('loc_EH14A', 'ws_default', 'layout_wh01', 3, 'EH14A', 'E', 'H', 14, 'A', 16.8, 17.5, 0.5, 'manual', 2, false),
    ('loc_EH14D', 'ws_default', 'layout_wh01', 3, 'EH14D', 'E', 'H', 14, 'D', 16.8, 17.5, 5.5, 'forklift', 2, false),
    ('loc_EC07A', 'ws_default', 'layout_wh01', 3, 'EC07A', 'E', 'C', 7, 'A', 8.4, 5.0, 0.5, 'manual', 2, false)
ON CONFLICT (id) DO NOTHING;

-- Seed Platforms
INSERT INTO public.platforms (id, workspace_id, location_id, position_index, max_mu_capacity)
VALUES
    ('plat_EH14A_1', 'ws_default', 'loc_EH14A', 1, 9),
    ('plat_EH14A_2', 'ws_default', 'loc_EH14A', 2, 9),
    ('plat_EH14D_1', 'ws_default', 'loc_EH14D', 1, 9),
    ('plat_EH14D_2', 'ws_default', 'loc_EH14D', 2, 9)
ON CONFLICT (id) DO NOTHING;

-- Seed Manipulation Units (502900 on Platform 1, 101003 on Platform 2)
INSERT INTO public.manipulation_units (id, workspace_id, platform_id, slot_index, status)
VALUES
    ('502900', 'ws_default', 'plat_EH14A_1', 1, 'active'),
    ('101003', 'ws_default', 'plat_EH14D_2', 1, 'active')
ON CONFLICT (id) DO NOTHING;

-- Seed Stock Ledger Entries (Receipts) for single unit piece picking
INSERT INTO public.stock_movements (
    movement_id, workspace_id, idempotency_key, movement_type,
    to_location_id, to_mu_id, sku, parent_sku, quantity_units, lot_number, reason
)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'ws_default', 'idemp_seed_001', 'RECEIPT', 'loc_EH14A', '502900', '1524289001', '1524289', 6, 'A92', 'Initial Seed'),
    ('a0000000-0000-0000-0000-000000000002', 'ws_default', 'idemp_seed_002', 'RECEIPT', 'loc_EH14A', '502900', '1524289002', '1524289', 5, 'A92', 'Initial Seed'),
    ('a0000000-0000-0000-0000-000000000003', 'ws_default', 'idemp_seed_003', 'RECEIPT', 'loc_EH14A', '502900', '1524289003', '1524289', 5, 'A92', 'Initial Seed'),
    ('a0000000-0000-0000-0000-000000000004', 'ws_default', 'idemp_seed_004', 'RECEIPT', 'loc_EH14D', '101003', '1524289004', '1524289', 6, 'B17', 'Initial Seed'),
    ('a0000000-0000-0000-0000-000000000005', 'ws_default', 'idemp_seed_005', 'RECEIPT', 'loc_EH14D', '101003', '2841920001', '2841920', 6, 'C04', 'Initial Seed')
ON CONFLICT (workspace_id, idempotency_key) DO NOTHING;
