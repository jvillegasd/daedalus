import { defaults, key, type Preferences } from './models';
import { matchesDomain } from './urls';

/** The preferences that are a list of domains: allowlists, exception lists, and one blocklist. */
export type DomainField = 'darkDomains' | 'darkExcluded' | 'autoplayDomains' | 'autoplayAllowlist' | 'consentDomains' | 'consentExcluded' | 'jsBlocked' | 'excludedDomains';

/** The three features that resolve as "a global default, overridden per site in both directions". */
export type Scoped = 'dark' | 'autoplay' | 'consent';
export const scopes = {
  dark: { global: 'darkEnabled', include: 'darkDomains', exclude: 'darkExcluded' },
  autoplay: { global: 'autoplayEnabled', include: 'autoplayDomains', exclude: 'autoplayAllowlist' },
  consent: { global: 'consentEnabled', include: 'consentDomains', exclude: 'consentExcluded' },
} as const satisfies Record<Scoped, { global: keyof Preferences; include: DomainField; exclude: DomainField }>;

/**
 * Whether the feature actually runs on this URL. The one thing a per-site button's pressed
 * state is allowed to mean — anything else and it reports a state the page does not have.
 *
 * Both lists default to empty, so this reproduces exactly what the three hand-written rules
 * did before it replaced them: with the global on, everything but the exclusions; with it
 * off, only the inclusions. No stored preference changes meaning.
 */
export const activeOn = (feature: Scoped, prefs: Preferences, url: string) => {
  const s = scopes[feature];
  return prefs[s.global] ? !matchesDomain(url, prefs[s.exclude]) : matchesDomain(url, prefs[s.include]);
};

/**
 * The list a click acts on: with the global on you are carving an exception out of it, with
 * it off you are opting one site in. Toggling the other list would be writing to something
 * nothing reads.
 */
export const liveField = (feature: Scoped, prefs: Preferences): DomainField =>
  prefs[scopes[feature].global] ? scopes[feature].exclude : scopes[feature].include;

/**
 * Whether a toggle should render pressed. The rule the buttons follow is "pressed means the
 * state the label names" — and autoplay's feature is *blocking*, while its button just says
 * "Autoplay". So a lit autoplay button means autoplay plays, the inverse of `activeOn`.
 *
 * The other two need no flip: "Dark" lit means dark mode runs, and GDPR's label carries the
 * negation itself (🚫), so lit means banners are being rejected.
 */
export const pressedOn = (feature: Scoped, prefs: Preferences, url: string) =>
  feature === 'autoplay' ? !activeOn(feature, prefs, url) : activeOn(feature, prefs, url);

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
