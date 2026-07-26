export type SavedTab = { url: string; title: string; favIconUrl?: string; pinned?: boolean };
export type TabGroup = { id: string; name: string; tags: string[]; tabs: SavedTab[]; createdAt: number };
export type RestoreTab = SavedTab & { closedAt: number };
export type Preferences = { cleanerEnabled: boolean; cleanerMinutes: number; excludedDomains: string[]; autoplayAllowlist: string[]; darkEnabled: boolean; darkExcluded: string[]; consentDomains: string[] };
export const defaults: Preferences = { cleanerEnabled: true, cleanerMinutes: 60, excludedDomains: [], autoplayAllowlist: [], darkEnabled: false, darkExcluded: [], consentDomains: [] };
export const key = { groups: 'groups', prefs: 'prefs', restore: 'restore' } as const;
