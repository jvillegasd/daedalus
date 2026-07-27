export const domainOf = (url: string) => { try { return new URL(url).hostname; } catch { return ''; } };
export const matchesDomain = (url: string, domains: string[]) => { const host = domainOf(url); return domains.some(d => host === d || host.endsWith(`.${d}`)); };
/** Move one entry by `delta` positions, clamped: out-of-range moves return the list unchanged. */
export const move = <T>(list: T[], index: number, delta: number) => { const to = index + delta; if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list; const next = [...list]; next.splice(to, 0, ...next.splice(index, 1)); return next; };
