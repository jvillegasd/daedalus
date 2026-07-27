export const domainOf = (url: string) => { try { return new URL(url).hostname; } catch { return ''; } };
export const matchesDomain = (url: string, domains: string[]) => { const host = domainOf(url); return domains.some(d => host === d || host.endsWith(`.${d}`)); };
