import { describe, expect, test } from 'bun:test';
import { addRestore, cookieImport, eligibleForCleaning, luminance, move, tabsToClean, reduceRedirect, scopedDomains } from '../src/domain';
import { uaRule, uaRuleId } from '../src/ua';

describe('Daedalus local rules', () => {
  test('cleaner closes stale tabs and spares protected ones', () => {
    const now = Date.parse('2026-07-26T12:00:00Z');
    const ago = (minutes: number) => now - minutes * 60_000;
    const tab = (id: number, over: Partial<chrome.tabs.Tab> & { lastAccessed?: number }) =>
      ({ id, url: `https://site${id}.com/`, active: false, pinned: false, audible: false, discarded: false, ...over }) as chrome.tabs.Tab;

    const tabs = [
      tab(1, { lastAccessed: ago(90) }),                    // stale
      tab(2, { lastAccessed: ago(10) }),                    // recent
      tab(3, { lastAccessed: ago(90), pinned: true }),      // pinned
      tab(4, { lastAccessed: ago(90) }),                    // has unsaved input
      tab(5, { lastAccessed: ago(90), url: 'https://keep.com/' }), // excluded domain
      tab(6, {}),                                           // no lastAccessed: treat as fresh
    ];
    const ids = tabsToClean(tabs, ['keep.com'], 60, [4], now).map(t => t.id);
    expect(ids).toEqual([1]);
  });

  test('move reorders and refuses to run off either end', () => {
    const list = ['a', 'b', 'c'];
    expect(move(list, 0, 1)).toEqual(['b', 'a', 'c']);
    expect(move(list, 2, -1)).toEqual(['a', 'c', 'b']);
    expect(move(list, 0, -1)).toBe(list);   // already first
    expect(move(list, 2, 1)).toBe(list);    // already last
    expect(move(list, -1, 1)).toBe(list);   // no such item
    expect(list).toEqual(['a', 'b', 'c']);  // never mutates
  });

  test('luminance separates dark pages from light ones', () => {
    expect(luminance('rgb(255, 255, 255)')).toBeCloseTo(1);
    expect(luminance('rgb(0, 0, 0)')).toBe(0);
    expect(luminance('rgb(18, 18, 18)')!).toBeLessThan(0.4);   // a typical dark theme keeps the filter off
    expect(luminance('rgb(240, 240, 240)')!).toBeGreaterThan(0.4);
    expect(luminance('rgba(0, 0, 0, 0)')).toBe(null);          // transparent: fall through to the next element
    expect(luminance('')).toBe(null);
  });

  test('cleaner protects active, pinned, audible, excluded and browser tabs', () => {
    const base = { id: 1, url: 'https://example.com/a', active: false, pinned: false, audible: false, discarded: false } as chrome.tabs.Tab;
    expect(eligibleForCleaning(base, [])).toBe(true);
    expect(eligibleForCleaning({ ...base, active: true }, [])).toBe(false);
    expect(eligibleForCleaning({ ...base, pinned: true }, [])).toBe(false);
    expect(eligibleForCleaning({ ...base, audible: true }, [])).toBe(false);
    expect(eligibleForCleaning(base, ['example.com'])).toBe(false);
    expect(eligibleForCleaning({ ...base, url: 'chrome://settings' }, [])).toBe(false);
  });
  test('restore history is newest-first and bounded', () => { const history = addRestore([], [{ url:'https://a', title:'a' }]); expect(history[0].url).toBe('https://a'); expect(history[0].closedAt).toBeNumber(); expect(addRestore(Array(100).fill(history[0]), [history[0]]).length).toBe(100); });
  test('domains scope cookies to tabs in one window', () => expect(scopedDomains([{ url:'https://a.example.com' }, {url:'https://example.com/x'}] as chrome.tabs.Tab[])).toEqual(['a.example.com','example.com']));
  test('cookie JSON requires required fields', () => { expect(() => cookieImport('{}')).toThrow(); expect(() => cookieImport('[{"name":"n","value":"v","domain":"example.com"}]')).not.toThrow(); });
  test('redirect reducer removes duplicate terminal entries', () => { const chain=reduceRedirect([], 'https://a', 301); expect(reduceRedirect(chain, 'https://a', 200)).toEqual([{ url: 'https://a', statusCode: 200 }]); });
  test('UA rules are tab-scoped and removable by stable id', () => { const r=uaRule(42,'UA'); expect(r.condition.tabIds).toEqual([42]); expect(r.id).toBe(uaRuleId(42)); });
});
