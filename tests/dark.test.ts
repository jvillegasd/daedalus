import { describe, expect, test } from 'bun:test';
import { darkCss, pageIsDark, samplePoints, wantsDark } from '../src/dark';
import { defaults, type Preferences } from '../src/models';

const prefs = (over: Partial<Preferences> = {}): Preferences => ({ ...defaults, ...over });

describe('dark', () => {
  test('brightness is omitted entirely at 100, so the default rule is unchanged', () => {
    expect(darkCss(100)).toContain('filter:invert(1) hue-rotate(180deg) !important');
    expect(darkCss(100)).not.toContain('brightness');
    expect(darkCss(60)).toContain('invert(1) hue-rotate(180deg) brightness(60%)');
  });

  // `picture` must stay out of the re-invert list: it wraps an img the same rule already
  // re-inverts, and listing both inverts the same pixels three times.
  test('the re-invert list covers media without doubling up on picture', () => {
    const media = darkCss(100).split('\n')[1];
    expect(media).toBe('img,video,canvas,iframe,embed,svg image{filter:invert(1) hue-rotate(180deg) !important}');
  });

  test('wantsDark follows the dark preference', () => {
    expect(wantsDark(prefs({ darkEnabled: true }), 'https://a.com/', 'text/html')).toBe(true);
    expect(wantsDark(prefs({ darkEnabled: false }), 'https://a.com/', 'text/html')).toBe(false);
    expect(wantsDark(prefs({ darkEnabled: true, darkExcluded: ['a.com'] }), 'https://a.com/', 'text/html')).toBe(false);
  });

  // Two dark modes on one page is the unreadable one: the JSON formatter paints its own,
  // and it paints it after this script has already measured and committed.
  test('a page the JSON formatter is about to take over is never inverted', () => {
    const on = prefs({ darkEnabled: true });
    expect(wantsDark(on, 'https://a.com/x.json', 'application/json')).toBe(false);
    expect(wantsDark(prefs({ darkEnabled: true, jsonFormat: false }), 'https://a.com/x.json', 'application/json')).toBe(true);
    expect(wantsDark(on, 'https://a.com/', 'text/html')).toBe(true);
  });

  test('pageIsDark averages what was found and ignores what was not', () => {
    expect(pageIsDark([0.05, 0.1, 0.05, 0.02])).toBe(true);
    expect(pageIsDark([1, 0.95, 1, 1])).toBe(false);
    expect(pageIsDark([null, 0.05, null, null])).toBe(true);
    // Mixed: a dark page with one white card in it is still dark on average.
    expect(pageIsDark([0.02, 0.02, 1, 0.02])).toBe(true);
  });

  // Measuring nothing must keep the inversion, or dark mode silently does nothing on every
  // page we failed to sample.
  test('a page that answered nothing counts as light', () => {
    expect(pageIsDark([null, null, null, null])).toBe(false);
    expect(pageIsDark([])).toBe(false);
  });

  test('the sample points stay inside the viewport and off dead centre', () => {
    expect(samplePoints).toHaveLength(4);
    for (const [x, y] of samplePoints) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(1);
    }
    expect(samplePoints.filter(([x, y]) => x === 0.5 && y === 0.5)).toHaveLength(1);
  });
});
