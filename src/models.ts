export type SavedTab = { url: string; title: string; favIconUrl?: string; pinned?: boolean };
export type TabGroup = { id: string; name: string; tags: string[]; tabs: SavedTab[]; createdAt: number };
export type RestoreTab = SavedTab & { closedAt: number };
/**
 * `autoplayEnabled` and the four `unhook*` surfaces default to what the code did before they
 * existed — blocking everywhere, hiding everything — so an upgrade changes nobody's browser.
 * `read()` spreads `defaults` first, which is what covers a synced profile written before them.
 */
export type Preferences = { cleanerEnabled: boolean; cleanerMinutes: number; cleanerSave: boolean; cleanerListName: string; excludedDomains: string[]; autoplayEnabled: boolean; autoplayAllowlist: string[]; darkEnabled: boolean; darkBrightness: number; darkExcluded: string[]; consentDomains: string[]; consentEnabled: boolean; jsBlocked: string[]; unhookEnabled: boolean; unhookFeed: boolean; unhookSuggestions: boolean; unhookEndscreen: boolean; unhookShorts: boolean; jsonFormat: boolean };
export const defaults: Preferences = { cleanerEnabled: true, cleanerMinutes: 60, cleanerSave: false, cleanerListName: 'Auto-saved', excludedDomains: [], autoplayEnabled: true, autoplayAllowlist: [], darkEnabled: false, darkBrightness: 100, darkExcluded: [], consentDomains: [], consentEnabled: false, jsBlocked: [], unhookEnabled: false, unhookFeed: true, unhookSuggestions: true, unhookEndscreen: true, unhookShorts: true, jsonFormat: true };
export const key = { groups: 'groups', prefs: 'prefs', restore: 'restore' } as const;
