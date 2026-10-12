import {
  InventoryLedgerRepository,
  WarehouseLayoutRepository,
  StockMovementLedgerEntry,
  StockReservation,
  CurrentStockBalance,
  WarehouseLayoutConfig
} from '@fulcrum/domain';
import { SupabaseClient } from '@supabase/supabase-js';

export class SupabaseInventoryLedgerRepository implements InventoryLedgerRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  public async appendMovement(entry: StockMovementLedgerEntry): Promise<StockMovementLedgerEntry> {
    const { data, error } = await this.supabase
      .from('stock_movements')
      .insert({
        movement_id: entry.movementId,
        workspace_id: entry.workspaceId,
        idempotency_key: entry.idempotencyKey,
        movement_type: entry.movementType,
        virtual_timestamp: entry.timestamp,
        from_location_id: entry.fromLocationId,
        to_location_id: entry.toLocationId,
        from_mu_id: entry.fromMuId,
        to_mu_id: entry.toMuId,
        sku: entry.sku,
        quantity_units: entry.quantityUnits,
        lot_number: entry.lotNumber,
        operator_id: entry.operatorId,
        reason: entry.reason
      })
      .select()
      .single();

    if (error) {
      // If unique constraint on (workspace_id, idempotency_key) was violated, fetch existing
      if (error.code === '23505') {
        const { data: existing } = await this.supabase
          .from('stock_movements')
          .select('*')
          .eq('workspace_id', entry.workspaceId)
          .eq('idempotency_key', entry.idempotencyKey)
          .single();
        if (existing) return entry;
      }
      throw new Error(`Failed to append stock movement: ${error.message}`);
    }

    return entry;
  }

  public async getMovements(workspaceId: string): Promise<StockMovementLedgerEntry[]> {
    const { data, error } = await this.supabase
      .from('stock_movements')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('movement_timestamp', { ascending: true });

    if (error) throw new Error(`Failed to fetch movements: ${error.message}`);

    return (data || []).map((row: any) => ({
      movementId: row.movement_id,
      workspaceId: row.workspace_id,
      idempotencyKey: row.idempotency_key,
      timestamp: row.virtual_timestamp || new Date(row.movement_timestamp).getTime(),
      movementType: row.movement_type,
      fromLocationId: row.from_location_id,
      toLocationId: row.to_location_id,
      fromMuId: row.from_mu_id,
      toMuId: row.to_mu_id,
      sku: row.sku,
      quantityUnits: row.quantity_units,
      lotNumber: row.lot_number,
      operatorId: row.operator_id,
      reason: row.reason
    }));
  }

  public async createReservation(reservation: StockReservation): Promise<StockReservation> {
    // 1. Verify available stock via the real-time projection view
    const { data: balance, error: balanceErr } = await this.supabase
      .from('v_current_stock_balance')
      .select('available_units')
      .eq('workspace_id', reservation.workspaceId)
      .eq('sku', reservation.sku)
      .eq('mu_id', reservation.muId)
      .single();

    if (balanceErr && balanceErr.code !== 'PGRST116') {
      throw new Error(`Failed to check stock balance: ${balanceErr.message}`);
    }

    const available = balance ? Number(balance.available_units) : 0;
    if (available < reservation.quantityUnits) {
      throw new Error(`Insufficient available stock for reservation. Available: ${available}, requested: ${reservation.quantityUnits}`);
    }

    // 2. Insert atomic reservation
    const { error: insertErr } = await this.supabase
      .from('stock_reservations')
      .insert({
        reservation_id: reservation.reservationId,
        workspace_id: reservation.workspaceId,
        order_id: reservation.orderId,
        line_id: reservation.lineId,
        sku: reservation.sku,
        quantity_units: reservation.quantityUnits,
        mu_id: reservation.muId,
        location_id: reservation.locationId,
        status: reservation.status
      });

    if (insertErr) throw new Error(`Failed to create stock reservation: ${insertErr.message}`);

    return reservation;
  }

  public async releaseReservation(reservationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('stock_reservations')
      .update({ status: 'RELEASED' })
      .eq('reservation_id', reservationId);

    if (error) throw new Error(`Failed to release reservation: ${error.message}`);
  }

  public async getCurrentStock(workspaceId: string, sku?: string): Promise<CurrentStockBalance[]> {
    let query = this.supabase
      .from('v_current_stock_balance')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (sku) {
      query = query.eq('sku', sku);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch current stock balance: ${error.message}`);

    return (data || []).map((row: any) => ({
      sku: row.sku,
      muId: row.mu_id,
      locationId: row.location_id,
      onHandUnits: Number(row.on_hand_units),
      reservedUnits: Number(row.reserved_units),
      availableUnits: Number(row.available_units)
    }));
  }
}

export class SupabaseWarehouseLayoutRepository implements WarehouseLayoutRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  public async getActiveLayout(workspaceId: string): Promise<WarehouseLayoutConfig | null> {
    const { data, error } = await this.supabase
      .from('warehouse_layouts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch active layout: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      version: data.version,
      workspaceId: data.workspace_id,
      name: data.name,
      ...data.config
    };
  }

  public async saveLayoutVersion(layout: WarehouseLayoutConfig): Promise<WarehouseLayoutConfig> {
    const active = await this.getActiveLayout(layout.workspaceId);
    const nextVersion = active ? active.version + 1 : 1;
    const versioned = { ...layout, version: nextVersion };

    const { error } = await this.supabase
      .from('warehouse_layouts')
      .insert({
        id: versioned.id,
        version: versioned.version,
        workspace_id: versioned.workspaceId,
        name: versioned.name,
        config: {
          prefixEnabled: versioned.prefixEnabled,
          sides: versioned.sides,
          rowType: versioned.rowType,
          rowStart: versioned.rowStart,
          rowCount: versioned.rowCount,
          defaultBaysPerRow: versioned.defaultBaysPerRow,
          bayOverrides: versioned.bayOverrides,
          bayPadding: versioned.bayPadding,
          rowPadding: versioned.rowPadding,
          levels: versioned.levels,
          separator: versioned.separator,
          defaultPlatformsPerLocation: versioned.defaultPlatformsPerLocation,
          defaultPlatformCapacityUnits: versioned.defaultPlatformCapacityUnits,
          bayWidthMeters: versioned.bayWidthMeters,
          levelHeightMeters: versioned.levelHeightMeters,
          aisleWidthMeters: versioned.aisleWidthMeters,
          blockedBays: versioned.blockedBays
        }
      });

    if (error) throw new Error(`Failed to save layout version: ${error.message}`);
    return versioned;
  }

  public async getLayoutHistory(workspaceId: string): Promise<WarehouseLayoutConfig[]> {
    const { data, error } = await this.supabase
      .from('warehouse_layouts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('version', { ascending: false });

    if (error) throw new Error(`Failed to fetch layout history: ${error.message}`);

    return (data || []).map((row: any) => ({
      id: row.id,
      version: row.version,
      workspaceId: row.workspace_id,
      name: row.name,
      ...row.config
    }));
  }
}
