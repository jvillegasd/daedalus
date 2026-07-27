import { defaults, key, type Preferences } from './models';

/** The preferences that are a list of domains: allowlists, exception lists, and one blocklist. */
export type DomainField = 'darkExcluded' | 'autoplayAllowlist' | 'consentDomains' | 'jsBlocked' | 'excludedDomains';

/**
 * The only door to `chrome.storage.sync`. Reading anywhere else means reading a profile that
 * has never been written as `{}` rather than as `defaults` — which the content script used to
 * do, and paid for with a `?.` on every field the type says is always there.
 */
export const read = async (): Promise<Preferences> => ({ ...defaults, ...((await chrome.storage.sync.get(key.prefs))[key.prefs] ?? {}) });

export const write = async (next: Partial<Preferences>) => { await chrome.storage.sync.set({ [key.prefs]: { ...(await read()), ...next } }); };

/** Present means remove, absent means add. Pure, so the rule itself is testable. */
export const toggled = (list: string[], domain: string) => list.includes(domain) ? list.filter(d => d !== domain) : [...list, domain];

/** Resolves to the domain's state afterwards: true if it is now in the list. */
export const toggleDomain = async (field: DomainField, domain: string) => {
  const next = toggled((await read())[field], domain);
  await write({ [field]: next });
  return next.includes(domain);
};
