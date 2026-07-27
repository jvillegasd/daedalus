import { describe, expect, test } from 'bun:test';
import { cookieImport, scopedUrls } from '../src/cookies';

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
});
