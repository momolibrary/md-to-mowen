import { describe, it, expect } from 'vitest';
import { VERSION } from '../../src/index.js';

describe('md-to-mowen', () => {
  it('should export VERSION', () => {
    expect(VERSION).toBe('1.0.0');
  });
});
