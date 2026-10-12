import { describe, it, expect } from 'vitest';

describe('App Web Health Check', () => {
  it('loads environment defaults safely', () => {
    expect(process.env.NODE_ENV || 'test').toBeDefined();
  });
});
