import { describe, expect, test } from 'bun:test';
import { domainOf, matchesDomain } from '../src/urls';

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

});
