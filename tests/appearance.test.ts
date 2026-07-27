import { describe, expect, test } from 'bun:test';
import { luminance } from '../src/appearance';

describe('appearance', () => {
  test('luminance separates dark pages from light ones', () => {
    expect(luminance('rgb(255, 255, 255)')).toBeCloseTo(1);
    expect(luminance('rgb(0, 0, 0)')).toBe(0);
    expect(luminance('rgb(18, 18, 18)')!).toBeLessThan(0.4);   // a typical dark theme keeps the filter off
    expect(luminance('rgb(240, 240, 240)')!).toBeGreaterThan(0.4);
    expect(luminance('rgba(0, 0, 0, 0)')).toBe(null);          // transparent: fall through to the next element
    expect(luminance('')).toBe(null);
  });
});
