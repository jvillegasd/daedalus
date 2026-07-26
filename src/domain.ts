import type { RestoreTab, SavedTab, TabGroup } from './models';

export const domainOf = (url: string) => { try { return new URL(url).hostname; } catch { return ''; } };
export const matchesDomain = (url: string, domains: string[]) => { const host = domainOf(url); return domains.some(d => host === d || host.endsWith(`.${d}`)); };
/** Relative luminance 0..1 of a computed CSS color, or null if it is transparent/unparseable. */
export const luminance = (color: string) => { const [r, g, b, a] = (color.match(/[\d.]+/g) ?? []).map(Number); if (r === undefined || g === undefined || b === undefined || a === 0) return null; return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
export const eligibleForCleaning = (tab: chrome.tabs.Tab, excluded: string[]) =>
  !!tab.id && !tab.active && !tab.pinned && !tab.audible && !tab.discarded && !!tab.url && !matchesDomain(tab.url, excluded) && !tab.url.startsWith('chrome:');
/** Move one entry by `delta` positions, clamped: out-of-range moves return the list unchanged. */
export const move = <T>(list: T[], index: number, delta: number) => { const to = index + delta; if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list; const next = [...list]; next.splice(to, 0, ...next.splice(index, 1)); return next; };
/**
 * Tabs the cleaner should close. Idle age comes from the browser's own `lastAccessed`
 * rather than bookkeeping of our own: a service worker is evicted while idle and restarted
 * by the alarm, so anything we tracked in memory is gone exactly when the alarm needs it.
 * A tab with no `lastAccessed` counts as just-used, so an unknown tab is never closed.
 */
export const tabsToClean = (tabs: chrome.tabs.Tab[], excluded: string[], minutes: number, unsaved: number[], now: number) =>
  tabs.filter(t => eligibleForCleaning(t, excluded)
    && !unsaved.includes(t.id!)
    && now - ((t as { lastAccessed?: number }).lastAccessed ?? now) >= minutes * 60_000);
/**
 * Append tabs to the list called `name`, creating it at the top if it doesn't exist yet.
 * Tabs already in the list by URL are skipped, so a page that keeps going stale doesn't
 * pile up duplicates.
 */
export const appendToList = (all: TabGroup[], name: string, tabs: SavedTab[], id: string, now: number): TabGroup[] => {
  const target = all.find(g => g.name === name);
  if (!target) return [{ id, name, tags: [], tabs, createdAt: now }, ...all];
  const fresh = tabs.filter(t => !target.tabs.some(x => x.url === t.url));
  return all.map(g => g === target ? { ...g, tabs: [...g.tabs, ...fresh] } : g);
};
export const addRestore = (history: RestoreTab[], tabs: SavedTab[]) => [...tabs.map(t => ({ ...t, closedAt: Date.now() })), ...history].slice(0, 100);
export const reduceRedirect = (chain: { url: string; statusCode?: number }[], url: string, statusCode?: number) =>
  chain.at(-1)?.url === url ? [...chain.slice(0, -1), { url, statusCode: statusCode ?? chain.at(-1)?.statusCode }] : [...chain, { url, statusCode }];
export const cookieImport = (json: string): chrome.cookies.CookieDetails[] => {
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error('Expected a JSON array of cookies.');
  return data.map((item) => {
    if (!item || typeof item !== 'object' || typeof (item as any).name !== 'string' || typeof (item as any).value !== 'string' || typeof (item as any).domain !== 'string') throw new Error('Every cookie needs name, value, and domain.');
    const c = item as Record<string, unknown>;
    return { name: c.name as string, value: c.value as string, domain: c.domain as string, path: typeof c.path === 'string' ? c.path : '/', secure: !!c.secure, httpOnly: !!c.httpOnly, sameSite: c.sameSite as chrome.cookies.SameSiteStatus | undefined, expirationDate: typeof c.expirationDate === 'number' ? c.expirationDate : undefined };
  });
};
/** Distinct http(s) URLs open in a window — the scope a cookie query gets narrowed to. */
export const scopedUrls = (tabs: chrome.tabs.Tab[]) => [...new Set(tabs.map(t => t.url).filter(u => u && /^https?:/i.test(u)))] as string[];
