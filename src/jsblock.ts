import { toggleDomain } from './preferences';

/** contentSettings patterns are not match patterns: `*.example.com` covers the bare domain too. */
export const sitePattern = (domain: string) => `*://*.${domain}/*`;

// ponytail: turning it back on writes an explicit 'allow' rather than dropping the rule —
// contentSettings has no per-pattern remove, only clear(), which wipes every site at once.
// Same outcome unless the profile's own default for JavaScript is block.
export const setJs = async (domain: string, blocked: boolean) => {
  await chrome.contentSettings?.javascript?.set({ primaryPattern: sitePattern(domain), setting: blocked ? 'block' : 'allow' });
};

/** Flips the stored blocklist and the browser setting together. Resolves to the new state. */
export const toggleJs = async (domain: string) => {
  const blocked = await toggleDomain('jsBlocked', domain);
  await setJs(domain, blocked);
  return blocked;
};
