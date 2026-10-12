export interface ExternalWmsOrderLine {
  line_number: number;
  item_code: string;
  requested_quantity: number;
}

export interface ExternalWmsOrder {
  order_reference: string;
  order_date: string;
  priority: 'URGENT' | 'STANDARD';
  lines: ExternalWmsOrderLine[];
}

export interface ExternalErpInventoryBalance {
  container_id: string; // MU code (e.g. 502900)
  storage_bin: string;   // Location code (e.g. EH14A)
  material_number: string;
  unrestricted_stock: number;
}

/**
 * Normalizes external WMS order payload into Fulcrum's SimulationOrder schema.
 */
export function normalizeWmsOrder(wmsOrder: ExternalWmsOrder, arrivalTimeSeconds = 0): {
  order_id: string;
  arrival_time: number;
  deadline: number;
  priority: 'HIGH' | 'STANDARD';
  items: Array<{ line_id: string; sku: string; quantity_units: number }>;
} {
  return {
    order_id: wmsOrder.order_reference.padStart(9, '0'),
    arrival_time: arrivalTimeSeconds,
    deadline: arrivalTimeSeconds + (wmsOrder.priority === 'URGENT' ? 1800 : 7200),
    priority: wmsOrder.priority === 'URGENT' ? 'HIGH' : 'STANDARD',
    items: wmsOrder.lines.map(line => ({
      line_id: `line_${line.line_number}`,
      sku: line.item_code,
      quantity_units: line.requested_quantity
    }))
  };
}

/**
 * Normalizes external ERP inventory balance payload into Fulcrum's SimulationInventoryItem schema.
 */
export function normalizeErpInventory(erpItem: ExternalErpInventoryBalance): {
  mu_id: string;
  location_id: string;
  sku: string;
  quantity_units: number;
} {
  return {
    mu_id: erpItem.container_id,
    location_id: `loc_${erpItem.storage_bin}`,
    sku: erpItem.material_number,
    quantity_units: erpItem.unrestricted_stock
  };
}
