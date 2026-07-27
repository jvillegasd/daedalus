import { matchesDomain } from './domain';
import { key, type Preferences, type RestoreTab, type SavedTab, type TabGroup } from './models';
import { read } from './preferences';
import { groups, setGroups } from './storage';

export const tabData = (t: chrome.tabs.Tab): SavedTab => ({ url: t.url!, title: t.title || t.url!, favIconUrl: t.favIconUrl, pinned: t.pinned });

export const eligibleForCleaning = (tab: chrome.tabs.Tab, excluded: string[]) =>
  !!tab.id && !tab.active && !tab.pinned && !tab.audible && !tab.discarded && !!tab.url && !matchesDomain(tab.url, excluded) && !tab.url.startsWith('chrome:');

/**
 * Tabs the cleaner should close. Idle age comes from the browser's own `lastAccessed`
 * rather than bookkeeping of our own: a service worker is evicted while idle and restarted
 * by the alarm, so anything we tracked in memory is gone exactly when the alarm needs it.
 * A tab with no `lastAccessed` counts as just-used, so an unknown tab is never closed.
 */
export const tabsToClean = (tabs: chrome.tabs.Tab[], excluded: string[], minutes: number, unsaved: number[], now: number) =>
  tabs.filter(t => eligibleForCleaning(t, excluded)
    && !unsaved.includes(t.id!)
    && now - ((t as { lastAccessed?: number }).lastAccessed ?? now) >= minutes * 60_000);

/**
 * Append tabs to the list called `name`, creating it at the top if it doesn't exist yet.
 * Tabs already in the list by URL are skipped, so a page that keeps going stale doesn't
 * pile up duplicates.
 */
export const appendToList = (all: TabGroup[], name: string, tabs: SavedTab[], id: string, now: number): TabGroup[] => {
  const target = all.find(g => g.name === name);
  if (!target) return [{ id, name, tags: [], tabs, createdAt: now }, ...all];
  const fresh = tabs.filter(t => !target.tabs.some(x => x.url === t.url));
  return all.map(g => g === target ? { ...g, tabs: [...g.tabs, ...fresh] } : g);
};

export const addRestore = (history: RestoreTab[], tabs: SavedTab[], now: number) => [...tabs.map(t => ({ ...t, closedAt: now })), ...history].slice(0, 100);

/**
 * Everything the cleaner decides, as data. `groups: null` means no list save was asked for,
 * so the applier is left with no policy of its own — it writes what it is given, in order.
 */
export type CleanPlan = { close: number[]; restore: RestoreTab[]; groups: TabGroup[] | null };

export const planClean = (input: {
  tabs: chrome.tabs.Tab[];
  prefs: Preferences;
  unsaved: number[];
  restore: RestoreTab[];
  groups: TabGroup[];
  id: string;
  now: number;
}): CleanPlan => {
  const { prefs: p, restore, now } = input;
  const empty = { close: [], restore, groups: null };
  if (!p.cleanerEnabled) return empty;
  const stale = tabsToClean(input.tabs, p.excludedDomains, p.cleanerMinutes, input.unsaved, now);
  if (!stale.length) return empty;
  const saved = stale.map(tabData);
  return {
    close: stale.map(t => t.id!),
    restore: addRestore(restore, saved, now),
    // Restore-last-closed lives in session storage and dies with the browser; saving to a
    // list is the durable option, so the plan carries it and the applier writes it first.
    groups: p.cleanerSave ? appendToList(input.groups, p.cleanerListName || 'Auto-saved', saved, input.id, now) : null,
  };
};

/** Writes both durable records before anything is destroyed. Nothing decided here. */
export const applyClean = async (plan: CleanPlan) => {
  if (!plan.close.length) return;
  await chrome.storage.session.set({ [key.restore]: plan.restore });
  if (plan.groups) await setGroups(plan.groups);
  await chrome.tabs.remove(plan.close);
};

export const runClean = async (unsaved: number[]) => {
  // The plan handles a disabled cleaner on its own; bailing here just avoids paying for the
  // gather on every alarm. Reading every saved list is the expensive one, so it stays behind
  // the preference that is the only reason to want them.
  const p = await read();
  if (!p.cleanerEnabled) return;
  await applyClean(planClean({
    tabs: await chrome.tabs.query({}),
    prefs: p,
    unsaved,
    restore: ((await chrome.storage.session.get(key.restore))[key.restore] ?? []) as RestoreTab[],
    groups: p.cleanerSave ? await groups() : [],
    id: crypto.randomUUID(),
    now: Date.now(),
  }));
};
