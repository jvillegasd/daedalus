import { describe, expect, test } from 'bun:test';
import { cookieImport, luminance, move, reduceRedirect, scopedUrls } from '../src/domain';
import { uaRule, uaRuleId } from '../src/ua';

describe('Daedalus local rules', () => {
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

  test('cookie scope is the distinct http(s) urls open in the window', () => expect(scopedUrls([{ url:'https://a.example.com' }, { url:'https://a.example.com' }, { url:'https://example.com/x' }, { url:'chrome://settings' }] as chrome.tabs.Tab[])).toEqual(['https://a.example.com','https://example.com/x']));
  test('cookie JSON requires required fields', () => { expect(() => cookieImport('{}')).toThrow(); expect(() => cookieImport('[{"name":"n","value":"v","domain":"example.com"}]')).not.toThrow(); });
  test('redirect reducer removes duplicate terminal entries', () => { const chain=reduceRedirect([], 'https://a', 301); expect(reduceRedirect(chain, 'https://a', 200)).toEqual([{ url: 'https://a', statusCode: 200 }]); });
  test('UA rules are tab-scoped and removable by stable id', () => { const r=uaRule(42,'UA'); expect(r.condition.tabIds).toEqual([42]); expect(r.id).toBe(uaRuleId(42)); });
});
