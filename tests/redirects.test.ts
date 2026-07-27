import { describe, expect, test } from 'bun:test';
import { redirectText, reduceRedirect } from '../src/redirects';

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

  test('copy text numbers every hop and shows a missing status rather than dropping it', () => {
    expect(redirectText([{ url: 'https://a', statusCode: 301 }, { url: 'https://b' }]))
      .toBe('1. 301  https://a\n2. ---  https://b');
  });

  test('an empty chain copies as nothing, not as a stray newline', () => {
    expect(redirectText([])).toBe('');
  });
});
