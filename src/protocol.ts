import type { RestoreTab, TabGroup } from './models';
import type { DomainField } from './preferences';
import type { Redirect } from './redirects';

/**
 * Every conversation the surfaces have with the worker. A kind's request and reply are
 * declared together, so adding one is a single entry here plus a single handler — rather
 * than a string literal in one file and a branch in another.
 */
export type Protocol = {
  'unsaved': { req: { value: boolean }; res: void };
  'save-tabs': { req: { windowId?: number; name: string; tags: string; close: boolean }; res: TabGroup };
  'restore': { req: { windowId?: number; tab: RestoreTab }; res: void };
  'redirects': { req: { tabId: number }; res: Redirect[] };
  'cookies': { req: { windowId?: number }; res: chrome.cookies.Cookie[] };
  'import-cookies': { req: { json: string }; res: void };
  'set-cookie': { req: { cookie: chrome.cookies.SetDetails }; res: void };
  'delete-cookie': { req: { url: string; name: string }; res: void };
  'toggle-pref': { req: { field: DomainField; domain: string }; res: boolean };
  'ua': { req: { windowId?: number; domain: string; value: string }; res: void };
};

export type Kind = keyof Protocol;
export type Handlers = { [K in Kind]: (payload: Protocol[K]['req'], sender: chrome.runtime.MessageSender) => Promise<Protocol[K]['res']> };

// Replies are wrapped rather than sent bare, so "the handler resolved with nothing" and
// "nothing answered at all" stay distinguishable — the difference every caller used to
// guess at with its own ad-hoc check.
type Reply<T> = { value: T } | { error: string };

/** Throws on a worker-side failure, so callers use try/catch instead of inventing a guard. */
export const send = async <K extends Kind>(kind: K, payload: Protocol[K]['req']): Promise<Protocol[K]['res']> => {
  const reply: Reply<Protocol[K]['res']> | undefined = await chrome.runtime.sendMessage({ type: kind, ...payload });
  if (!reply) throw new Error(`No response from the background worker (${kind}).`);
  if ('error' in reply) throw new Error(reply.error);
  return reply.value;
};

/**
 * Owns the MV3 listener contract in one place: `return true` to keep the reply channel open
 * for an async handler, and a reply on every path — including the failing one, which would
 * otherwise leave the caller waiting on a promise that never settles.
 */
export const handle = (handlers: Handlers) => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handler = handlers[message?.type as Kind];
    if (!handler) return false;
    handler(message, sender).then(
      value => sendResponse({ value }),
      e => sendResponse({ error: e instanceof Error ? e.message : String(e) }),
    );
    return true;
  });
};
