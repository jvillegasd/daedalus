import { describe, expect, test } from 'bun:test';
import { addRestore, appendToList, applyClean, eligibleForCleaning, planClean, tabsToClean } from '../src/cleaner';
import { defaults, key, type Preferences, type TabGroup } from '../src/models';

const now = Date.parse('2026-07-26T12:00:00Z');
const ago = (minutes: number) => now - minutes * 60_000;
const tab = (id: number, over: Partial<chrome.tabs.Tab> & { lastAccessed?: number } = {}) =>
  ({ id, url: `https://site${id}.com/`, title: `Site ${id}`, active: false, pinned: false, audible: false, discarded: false, ...over }) as chrome.tabs.Tab;
const plan = (over: { tabs?: chrome.tabs.Tab[]; prefs?: Partial<Preferences>; groups?: TabGroup[]; unsaved?: number[] } = {}) =>
  planClean({
    tabs: over.tabs ?? [tab(1, { lastAccessed: ago(90) })],
    prefs: { ...defaults, ...over.prefs },
    unsaved: over.unsaved ?? [],
    restore: [],
    groups: over.groups ?? [],
    id: 'plan-id',
    now,
  });

describe('cleaner rules', () => {
  test('closes stale tabs and spares protected ones', () => {
    const tabs = [
      tab(1, { lastAccessed: ago(90) }),                            // stale
      tab(2, { lastAccessed: ago(10) }),                            // recent
      tab(3, { lastAccessed: ago(90), pinned: true }),              // pinned
      tab(4, { lastAccessed: ago(90) }),                            // has unsaved input
      tab(5, { lastAccessed: ago(90), url: 'https://keep.com/' }),  // excluded domain
      tab(6),                                                       // no lastAccessed: treat as fresh
    ];
    expect(tabsToClean(tabs, ['keep.com'], 60, [4], now).map(t => t.id)).toEqual([1]);
  });

  test('protects active, pinned, audible, excluded and browser tabs', () => {
    const base = tab(1);
    expect(eligibleForCleaning(base, [])).toBe(true);
    expect(eligibleForCleaning({ ...base, active: true }, [])).toBe(false);
    expect(eligibleForCleaning({ ...base, pinned: true }, [])).toBe(false);
    expect(eligibleForCleaning({ ...base, audible: true }, [])).toBe(false);
    expect(eligibleForCleaning(base, ['site1.com'])).toBe(false);
    expect(eligibleForCleaning({ ...base, url: 'chrome://settings' }, [])).toBe(false);
  });

  test('list is created once, then appended to without duplicates', () => {
    const t = (url: string) => ({ url, title: url });
    const first = appendToList([], 'Auto-saved', [t('https://a.com')], 'id-1', 1);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ id: 'id-1', name: 'Auto-saved', tags: [] });

    const second = appendToList(first, 'Auto-saved', [t('https://a.com'), t('https://b.com')], 'id-2', 2);
    expect(second).toHaveLength(1);                                    // reused, not recreated
    expect(second[0].tabs.map(x => x.url)).toEqual(['https://a.com', 'https://b.com']);

    const other = appendToList(second, 'Reading', [t('https://c.com')], 'id-3', 3);
    expect(other.map(g => g.name)).toEqual(['Reading', 'Auto-saved']);  // new list goes on top
  });

  test('restore history is newest-first and bounded', () => {
    const history = addRestore([], [{ url: 'https://a', title: 'a' }], now);
    expect(history[0]).toMatchObject({ url: 'https://a', closedAt: now });
    expect(addRestore(Array(100).fill(history[0]), [history[0]], now)).toHaveLength(100);
  });
});

describe('cleaner plan', () => {
  test('a disabled cleaner plans nothing, whatever is stale', () => {
    expect(plan({ prefs: { cleanerEnabled: false } })).toEqual({ close: [], restore: [], groups: null });
  });

  test('nothing stale plans nothing', () => {
    expect(plan({ tabs: [tab(1, { lastAccessed: ago(5) })] }).close).toEqual([]);
  });

  test('without cleanerSave the plan carries no list write', () => {
    const p = plan();
    expect(p.close).toEqual([1]);
    expect(p.restore.map(t => t.url)).toEqual(['https://site1.com/']);
    expect(p.groups).toBe(null);
  });

  test('with cleanerSave the closed tabs are filed before they are closed', () => {
    const p = plan({ prefs: { cleanerSave: true, cleanerListName: 'Stale' } });
    expect(p.groups![0]).toMatchObject({ name: 'Stale', tags: [] });
    expect(p.groups![0].tabs.map(t => t.url)).toEqual(['https://site1.com/']);
    expect(p.close).toEqual([1]);
  });

  test('a blank list name falls back to Auto-saved', () => {
    expect(plan({ prefs: { cleanerSave: true, cleanerListName: '' } }).groups![0].name).toBe('Auto-saved');
  });

  test('re-filing the same tab into an existing list does not duplicate it', () => {
    const existing: TabGroup[] = [{ id: 'g', name: 'Auto-saved', tags: [], tabs: [{ url: 'https://site1.com/', title: 'Site 1' }], createdAt: 0 }];
    const p = plan({ prefs: { cleanerSave: true }, groups: existing });
    expect(p.groups).toHaveLength(1);
    expect(p.groups![0].tabs).toHaveLength(1);
  });
});

describe('applying a plan', () => {
  /** Records the order effects land in, so "durable writes before destruction" is asserted, not assumed. */
  const spyChrome = () => {
    const calls: string[] = [];
    (globalThis as any).chrome = {
      storage: {
        session: { set: async () => { calls.push('restore'); } },
        local: { set: async () => { calls.push('groups'); }, get: async () => ({}) },
      },
      tabs: { remove: async () => { calls.push('remove'); } },
    };
    return calls;
  };

  test('writes the restore history and the list before removing tabs', async () => {
    const calls = spyChrome();
    await applyClean({ close: [1], restore: [{ url: 'https://a', title: 'a', closedAt: now }], groups: [] });
    expect(calls).toEqual(['restore', 'groups', 'remove']);
  });

  test('skips the list write when the plan carries none, and still removes last', async () => {
    const calls = spyChrome();
    await applyClean({ close: [1], restore: [], groups: null });
    expect(calls).toEqual(['restore', 'remove']);
  });

  test('an empty plan touches nothing', async () => {
    const calls = spyChrome();
    await applyClean({ close: [], restore: [{ url: 'https://a', title: 'a', closedAt: now }], groups: [] });
    expect(calls).toEqual([]);
  });

  test('the restore write uses the session key the panel reads back', async () => {
    const written: Record<string, unknown>[] = [];
    (globalThis as any).chrome = {
      storage: { session: { set: async (v: Record<string, unknown>) => { written.push(v); } }, local: { set: async () => {}, get: async () => ({}) } },
      tabs: { remove: async () => {} },
    };
    await applyClean({ close: [1], restore: [], groups: null });
    expect(Object.keys(written[0])).toEqual([key.restore]);
  });
});
