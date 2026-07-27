import { key, type TabGroup } from './models';
export async function groups() { return ((await chrome.storage.local.get(key.groups))[key.groups] ?? []) as TabGroup[]; }
export async function saveGroup(group: TabGroup) { await chrome.storage.local.set({ [key.groups]: [group, ...(await groups())] }); }
export async function setGroups(list: TabGroup[]) { await chrome.storage.local.set({ [key.groups]: list }); }
