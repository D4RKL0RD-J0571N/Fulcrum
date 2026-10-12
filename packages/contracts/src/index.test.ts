import { describe, it, expect } from 'vitest';
import {
  SimulationLocationSchema,
  SimulationOrderSchema,
  SimulationInputSnapshotSchema
} from './index';

describe('Contracts Schema Validation', () => {
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

  it('rejects invalid access types', () => {
    const invalid = {
      id: 'loc_01',
      x: 10,
      y: 20,
      z: 1.5,
      access_type: 'automated_drone'
    };
    expect(() => SimulationLocationSchema.parse(invalid)).toThrow();
  });
});
