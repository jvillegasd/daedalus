import { describe, expect, test } from 'bun:test';
import { addRestore, cookieImport, eligibleForCleaning, reduceRedirect, scopedDomains } from '../src/domain';
import { uaRule, uaRuleId } from '../src/ua';

describe('Daedalus local rules', () => {
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
