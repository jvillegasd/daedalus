import { defaults, key, type Preferences, type TabGroup } from './models';
export async function groups() { return ((await chrome.storage.local.get(key.groups))[key.groups] ?? []) as TabGroup[]; }
export async function saveGroup(group: TabGroup) { await chrome.storage.local.set({ [key.groups]: [group, ...(await groups())] }); }
export async function setGroups(list: TabGroup[]) { await chrome.storage.local.set({ [key.groups]: list }); }
export async function removeGroup(id: string) { await setGroups((await groups()).filter(g => g.id !== id)); }
export async function prefs() { return { ...defaults, ...((await chrome.storage.sync.get(key.prefs))[key.prefs] ?? {}) } as Preferences; }
export async function savePrefs(next: Partial<Preferences>) { await chrome.storage.sync.set({ [key.prefs]: { ...(await prefs()), ...next } }); }
