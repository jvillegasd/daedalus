import { describe, expect, test } from 'bun:test';
import { cookieDetails, cookieImport, cookieMoved, scopedUrls } from '../src/cookies';

describe('cookies', () => {
  test('scope is the distinct http(s) urls open in the window', () => {
    expect(scopedUrls([{ url: 'https://a.example.com' }, { url: 'https://a.example.com' }, { url: 'https://example.com/x' }, { url: 'chrome://settings' }] as chrome.tabs.Tab[]))
      .toEqual(['https://a.example.com', 'https://example.com/x']);
  });

  test('import requires an array of cookies with the required fields', () => {
    expect(() => cookieImport('{}')).toThrow('Expected a JSON array of cookies.');
    expect(() => cookieImport('[{"name":"n"}]')).toThrow('Every cookie needs name, value, and domain.');
    expect(() => cookieImport('[{"name":"n","value":"v","domain":"example.com"}]')).not.toThrow();
  });

  test('import fills in the optional fields it is allowed to assume', () => {
    const [c] = cookieImport('[{"name":"n","value":"v","domain":"example.com"}]');
    expect(c).toMatchObject({ path: '/', secure: false, httpOnly: false });
    expect(c.expirationDate).toBeUndefined();
  });

  const edit = { name: 'sid', value: 'v', domain: '.example.com', path: '/app', secure: true, httpOnly: false };

  test('an edit is addressed by url, and carries every field set() would otherwise drop', () => {
    expect(cookieDetails({ ...edit, sameSite: 'lax' })).toEqual({
      url: 'https://example.com/app', name: 'sid', value: 'v', domain: '.example.com',
      path: '/app', secure: true, httpOnly: false, sameSite: 'lax', expirationDate: undefined,
    });
  });

  // Passing a domain to set() is what makes a cookie cover subdomains, so a host-only
  // cookie has to omit it or editing its value quietly widens its scope.
  test('a host-only cookie is written without a domain', () => {
    expect(cookieDetails({ ...edit, hostOnly: true }).domain).toBeUndefined();
  });

  test('only a change of domain, path, or name counts as a move', () => {
    expect(cookieMoved(edit, { ...edit, value: 'other' })).toBe(false);
    expect(cookieMoved(edit, { ...edit, path: '/' })).toBe(true);
    expect(cookieMoved(edit, { ...edit, name: 'other' })).toBe(true);
    expect(cookieMoved(edit, { ...edit, domain: 'example.com' })).toBe(true);
  });
});
