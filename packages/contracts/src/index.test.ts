import { describe, it, expect } from 'vitest';
import {
  SimulationLocationSchema,
  SimulationOrderSchema,
  SimulationInputSnapshotSchema
} from './index';

describe('Contracts Schema Validation', () => {
  it('validates a 9-digit zero-padded order with piece-pick items', () => {
    const order = {
      order_id: '000815296',
      arrival_time: 120,
      deadline: 3600,
      priority: 'HIGH',
      items: [
        { line_id: 'l1', sku: '1524289001', quantity_units: 1 },
        { line_id: 'l2', sku: '1524289002', quantity_units: 2 }
      ]
    };
    expect(() => SimulationOrderSchema.parse(order)).not.toThrow();
  });

  it('validates a correct SimulationLocation', () => {
    const valid = {
      id: 'loc_01',
      x: 10,
      y: 20,
      z: 1.5,
      access_type: 'manual',
      capacity: 2,
      is_blocked: false
    };
    expect(() => SimulationLocationSchema.parse(valid)).not.toThrow();
  });
});
