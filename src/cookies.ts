/** The URL a cookie has to be addressed by: chrome.cookies keys on a URL, not a domain. */
export const cookieUrl = (c: { domain?: string; path?: string; secure?: boolean }) =>
  `${c.secure ? 'https' : 'http'}://${(c.domain ?? '').replace(/^\./, '')}${c.path || '/'}`;

/** What the edit form holds: every field `chrome.cookies.set` accepts, plus the host-only flag. */
export type CookieEdit = {
  name: string; value: string; domain: string; path: string;
  secure: boolean; httpOnly: boolean;
  sameSite?: chrome.cookies.SameSiteStatus; expirationDate?: number; hostOnly?: boolean;
};

/**
 * `chrome.cookies.set` replaces, it does not merge, and it keys on domain+path+name — so a
 * set with any of those three changed writes a *second* cookie and leaves the first behind.
 * The form therefore sends the whole record, and the caller pairs a move with a delete of
 * the old address (see `cookieMoved`). `domain` is omitted for a host-only cookie, because
 * passing one turns it into a domain cookie that also covers every subdomain.
 */
export const cookieDetails = (e: CookieEdit): chrome.cookies.SetDetails => ({
  url: cookieUrl(e),
  name: e.name,
  value: e.value,
  domain: e.hostOnly ? undefined : e.domain,
  path: e.path || '/',
  secure: e.secure,
  httpOnly: e.httpOnly,
  sameSite: e.sameSite,
  expirationDate: e.expirationDate,
});

/** True when an edit changed a cookie's identity, so writing it leaves an orphan behind. */
export const cookieMoved = (before: { domain: string; path: string; name: string }, after: CookieEdit) =>
  before.domain !== after.domain || before.path !== after.path || before.name !== after.name;

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
