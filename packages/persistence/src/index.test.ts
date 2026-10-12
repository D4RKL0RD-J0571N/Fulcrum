import { describe, it, expect } from 'vitest';
import { SupabaseInventoryLedgerRepository, SupabaseWarehouseLayoutRepository } from './index';

describe('Supabase Repositories Interface Alignment', () => {
  it('instantiates SupabaseInventoryLedgerRepository with Supabase client duck type', () => {
    const mockSupabase: any = {
      from: () => ({ select: () => ({}) })
    };
    const repo = new SupabaseInventoryLedgerRepository(mockSupabase);
    expect(repo).toBeDefined();
    expect(typeof repo.appendMovement).toBe('function');
    expect(typeof repo.createReservation).toBe('function');
  });

  it('instantiates SupabaseWarehouseLayoutRepository with Supabase client duck type', () => {
    const mockSupabase: any = {
      from: () => ({ select: () => ({}) })
    };
    const repo = new SupabaseWarehouseLayoutRepository(mockSupabase);
    expect(repo).toBeDefined();
    expect(typeof repo.getActiveLayout).toBe('function');
    expect(typeof repo.saveLayoutVersion).toBe('function');
  });
});
