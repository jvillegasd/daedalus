import { describe, expect, test } from 'bun:test';
import { reduceRedirect } from '../src/redirects';

describe('redirects', () => {
  test('the status report updates the entry the request opened', () => {
    const chain = reduceRedirect([], 'https://a', 301);
    expect(reduceRedirect(chain, 'https://a', 200)).toEqual([{ url: 'https://a', statusCode: 200 }]);
  });

  test('a different URL extends the chain', () => {
    const chain = reduceRedirect(reduceRedirect([], 'https://a', 301), 'https://b');
    expect(chain.map(r => r.url)).toEqual(['https://a', 'https://b']);
  });

  test('a repeat with no status keeps the one already recorded', () => {
    const chain = reduceRedirect(reduceRedirect([], 'https://a', 301), 'https://a');
    expect(chain).toEqual([{ url: 'https://a', statusCode: 301 }]);
  });
});
