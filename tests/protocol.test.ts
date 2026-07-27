import { describe, expect, test } from 'bun:test';
import { handlers, redirects } from '../src/handlers';
import { handle, send, type Handlers } from '../src/protocol';

/**
 * Wires `send` straight into `handle` through a stand-in for the runtime, so a test exercises
 * the same round trip a real message takes: wrapped reply, error envelope, and the listener's
 * `return true`. The worker's own reply is never seen by callers, only what `send` makes of it.
 */
const connect = (partial: Partial<Handlers>, sender: chrome.runtime.MessageSender = {}) => {
  let listener: (m: any, s: any, respond: (r: any) => void) => boolean;
  const kept: boolean[] = [];
  (globalThis as any).chrome = {
    runtime: {
      onMessage: { addListener: (fn: typeof listener) => { listener = fn; } },
      sendMessage: (message: any) => new Promise(resolve => {
        const open = listener(message, sender, resolve);
        kept.push(open);
        if (!open) resolve(undefined);   // an unhandled kind: Chrome answers nothing
      }),
    },
  };
  handle(partial as Handlers);
  return kept;
};

describe('worker protocol', () => {
  test('a reply reaches the caller typed, not wrapped', async () => {
    connect({ 'toggle-pref': async p => p.domain === 'a.com' });
    expect(await send('toggle-pref', { field: 'darkExcluded', domain: 'a.com' })).toBe(true);
  });

  test('a handler that resolves with nothing still answers', async () => {
    connect({ 'unsaved': async () => {} });
    expect(await send('unsaved', { value: true })).toBeUndefined();
  });

  test('a throwing handler surfaces as a rejected send, with its message', async () => {
    connect({ 'import-cookies': async () => { throw new Error('Every cookie needs name, value, and domain.'); } });
    await expect(send('import-cookies', { json: '[]' })).rejects.toThrow('Every cookie needs name, value, and domain.');
  });

  test('a handler that rejects with a non-Error still produces a message', async () => {
    connect({ 'import-cookies': async () => { throw 'bare string'; } });
    await expect(send('import-cookies', { json: '[]' })).rejects.toThrow('bare string');
  });

  test('nothing answering is an error, not a silent undefined', async () => {
    connect({});   // no handler registered for this kind
    await expect(send('redirects', { tabId: 1 })).rejects.toThrow('No response from the background worker (redirects).');
  });

  test('the listener keeps the reply channel open for a known kind, and only then', async () => {
    const kept = connect({ 'unsaved': async () => {} });
    await send('unsaved', { value: true });
    await send('redirects', { tabId: 1 }).catch(() => {});
    expect(kept).toEqual([true, false]);
  });

  test('payload fields reach the handler, and the sender does too', async () => {
    let seen: unknown;
    connect({ 'unsaved': async (p, s) => { seen = [p.value, s.tab?.id]; } }, { tab: { id: 7 } as chrome.tabs.Tab });
    await send('unsaved', { value: false });
    expect(seen).toEqual([false, 7]);
  });
});

describe('handlers', () => {
  test('redirects answers with the chain recorded for that tab, and an empty one otherwise', async () => {
    redirects.set(3, [{ url: 'https://a', statusCode: 301 }, { url: 'https://b', statusCode: 200 }]);
    connect({ 'redirects': handlers.redirects });
    expect(await send('redirects', { tabId: 3 })).toHaveLength(2);
    expect(await send('redirects', { tabId: 999 })).toEqual([]);
    redirects.clear();
  });
});
