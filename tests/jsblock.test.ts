import { beforeEach, describe, expect, test } from 'bun:test';
import { key } from '../src/models';
import { sitePattern, toggleJs } from '../src/jsblock';

let stored: Record<string, unknown>;
let applied: { primaryPattern: string; setting: string }[];
beforeEach(() => {
  stored = {};
  applied = [];
  (globalThis as any).chrome = {
    storage: { sync: {
      get: async (k: string) => (k in stored ? { [k]: stored[k] } : {}),
      set: async (patch: Record<string, unknown>) => { Object.assign(stored, patch); },
    } },
    contentSettings: { javascript: { set: async (d: any) => { applied.push(d); } } },
  };
});

describe('javascript blocking', () => {
  test('the pattern covers the domain and its subdomains on either scheme', () => {
    expect(sitePattern('example.com')).toBe('*://*.example.com/*');
  });

  test('toggling writes the blocklist and the browser setting together, both ways', async () => {
    expect(await toggleJs('example.com')).toBe(true);
    expect((stored[key.prefs] as any).jsBlocked).toEqual(['example.com']);
    expect(applied.at(-1)).toEqual({ primaryPattern: '*://*.example.com/*', setting: 'block' });

    expect(await toggleJs('example.com')).toBe(false);
    expect((stored[key.prefs] as any).jsBlocked).toEqual([]);
    expect(applied.at(-1)).toEqual({ primaryPattern: '*://*.example.com/*', setting: 'allow' });
  });
});
