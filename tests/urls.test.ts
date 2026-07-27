import { describe, expect, test } from 'bun:test';
import { domainOf, matchesDomain, move } from '../src/urls';

describe('urls', () => {
  test('domainOf reads the host, and an unparseable URL is not a host', () => {
    expect(domainOf('https://a.example.com/x?y')).toBe('a.example.com');
    expect(domainOf('not a url')).toBe('');
  });

  test('matchesDomain covers subdomains but not lookalikes', () => {
    expect(matchesDomain('https://example.com/', ['example.com'])).toBe(true);
    expect(matchesDomain('https://a.example.com/', ['example.com'])).toBe(true);
    expect(matchesDomain('https://notexample.com/', ['example.com'])).toBe(false);
    expect(matchesDomain('https://example.com/', [])).toBe(false);
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
});
