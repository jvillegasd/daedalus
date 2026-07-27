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
