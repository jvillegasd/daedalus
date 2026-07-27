import { beforeEach, describe, expect, test } from 'bun:test';
import { key } from '../src/models';
import { targetHost, targetTab, toggleSite } from '../src/surface';

const page = (id: number, url: string, over: Partial<chrome.tabs.Tab> & { lastAccessed?: number } = {}) =>
  ({ id, url, active: false, ...over }) as chrome.tabs.Tab;

let tabs: chrome.tabs.Tab[];
let stored: Record<string, unknown>;
let sent: any[];
let reloaded: number[];
let contentSettings: { primaryPattern: string; setting: string }[];

beforeEach(() => {
  tabs = [];
  stored = {};
  sent = [];
  reloaded = [];
  contentSettings = [];
  (globalThis as any).location = { origin: 'chrome-extension://daedalus' };
  (globalThis as any).chrome = {
    tabs: { query: async () => tabs, reload: async (id: number) => { reloaded.push(id); } },
    runtime: { sendMessage: async (m: any) => { sent.push(m); return { value: true }; } },
    storage: { sync: {
      get: async (k: string) => (k in stored ? { [k]: stored[k] } : {}),
      set: async (v: Record<string, unknown>) => { Object.assign(stored, v); },
    } },
    contentSettings: { javascript: { set: async (v: any) => { contentSettings.push(v); } } },
  };
});

describe('surface', () => {
  test('targetTab prefers the active page tab', async () => {
    tabs = [page(1, 'https://a.com/'), page(2, 'https://b.com/', { active: true })];
    expect((await targetTab())?.id).toBe(2);
  });

  // The manager runs as an ordinary tab where the sidePanel API is missing, and there the
  // active tab is the manager itself.
  test('targetTab skips our own page and falls back to the most recently used', async () => {
    tabs = [
      page(1, 'chrome-extension://daedalus/sidepanel.html', { active: true }),
      page(2, 'https://old.com/', { lastAccessed: 100 }),
      page(3, 'https://recent.com/', { lastAccessed: 900 }),
    ];
    expect((await targetTab())?.id).toBe(3);
  });

  test('targetHost reads the host, and a tab with no url is no host', async () => {
    expect(targetHost(page(1, 'https://a.example.com/x?y'))).toBe('a.example.com');
    expect(targetHost(undefined)).toBe('');
  });

  test('toggleSite routes the three scoped features through the worker', async () => {
    tabs = [page(1, 'https://example.com/', { active: true })];
    expect(await toggleSite('dark')).toBe(true);
    expect(sent).toEqual([{ type: 'toggle-pref', field: 'darkDomains', domain: 'example.com' }]);
    expect(reloaded).toEqual([]);
  });

  // JavaScript writes a browser setting rather than a preference, so the page has to reload.
  test('toggleSite writes the content setting and reloads for js', async () => {
    tabs = [page(7, 'https://example.com/', { active: true })];
    expect(await toggleSite('js')).toBe(true);
    expect((stored[key.prefs] as any).jsBlocked).toEqual(['example.com']);
    expect(contentSettings.at(-1)).toEqual({ primaryPattern: '*://*.example.com/*', setting: 'block' });
    expect(reloaded).toEqual([7]);
    expect(sent).toEqual([]);
  });

  // What the callers check before paying for a re-render.
  test('toggleSite resolves false when there is no page tab', async () => {
    tabs = [page(1, 'chrome-extension://daedalus/sidepanel.html', { active: true })];
    expect(await toggleSite('dark')).toBe(false);
    expect(await toggleSite('js')).toBe(false);
    expect(sent).toEqual([]);
    expect(reloaded).toEqual([]);
  });
});
