export type SavedTab = { url: string; title: string; favIconUrl?: string; pinned?: boolean };
export type TabGroup = { id: string; name: string; tags: string[]; tabs: SavedTab[]; createdAt: number };
export type RestoreTab = SavedTab & { closedAt: number };
/**
 * `autoplayEnabled` and the four `unhook*` surfaces default to what the code did before they
 * existed — blocking everywhere, hiding everything — so an upgrade changes nobody's browser.
 * `read()` spreads `defaults` first, which is what covers a synced profile written before them.
 */
/**
 * Dark mode, autoplay and GDPR each have a global switch and two override lists: one that
 * turns the feature on for a site while the global is off, one that turns it off while the
 * global is on. Before both existed, whichever list the global did not consult was inert —
 * a per-site button that flipped its own pressed state and changed nothing. See `activeOn`.
 *
 * `autoplayAllowlist` is the exclusion list despite the name; it keeps it so an upgrade does
 * not discard the sites already in it.
 */
export type Preferences = { cleanerEnabled: boolean; cleanerMinutes: number; cleanerSave: boolean; cleanerListName: string; excludedDomains: string[]; autoplayEnabled: boolean; autoplayDomains: string[]; autoplayAllowlist: string[]; darkEnabled: boolean; darkBrightness: number; darkDomains: string[]; darkExcluded: string[]; consentEnabled: boolean; consentDomains: string[]; consentExcluded: string[]; jsBlocked: string[]; unhookEnabled: boolean; unhookFeed: boolean; unhookSuggestions: boolean; unhookEndscreen: boolean; unhookShorts: boolean; jsonFormat: boolean };
export const defaults: Preferences = { cleanerEnabled: true, cleanerMinutes: 60, cleanerSave: false, cleanerListName: 'Auto-saved', excludedDomains: [], autoplayEnabled: true, autoplayDomains: [], autoplayAllowlist: [], darkEnabled: false, darkBrightness: 100, darkDomains: [], darkExcluded: [], consentEnabled: false, consentDomains: [], consentExcluded: [], jsBlocked: [], unhookEnabled: false, unhookFeed: true, unhookSuggestions: true, unhookEndscreen: true, unhookShorts: true, jsonFormat: true };
export const key = { groups: 'groups', prefs: 'prefs', restore: 'restore' } as const;
