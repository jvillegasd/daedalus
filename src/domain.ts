import type { RestoreTab, SavedTab } from './models';

export const domainOf = (url: string) => { try { return new URL(url).hostname; } catch { return ''; } };
export const matchesDomain = (url: string, domains: string[]) => { const host = domainOf(url); return domains.some(d => host === d || host.endsWith(`.${d}`)); };
/** Relative luminance 0..1 of a computed CSS color, or null if it is transparent/unparseable. */
export const luminance = (color: string) => { const [r, g, b, a] = (color.match(/[\d.]+/g) ?? []).map(Number); if (r === undefined || g === undefined || b === undefined || a === 0) return null; return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
export const eligibleForCleaning = (tab: chrome.tabs.Tab, excluded: string[]) =>
  !!tab.id && !tab.active && !tab.pinned && !tab.audible && !tab.discarded && !!tab.url && !matchesDomain(tab.url, excluded) && !tab.url.startsWith('chrome:');
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
export const scopedDomains = (tabs: chrome.tabs.Tab[]) => [...new Set(tabs.map(t => t.url && domainOf(t.url)).filter(Boolean))] as string[];
