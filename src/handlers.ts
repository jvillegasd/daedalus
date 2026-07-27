import { tabData } from './cleaner';
import { cookieImport, cookieUrl, scopedUrls } from './cookies';
import { domainOf } from './urls';
import { key, type RestoreTab, type TabGroup } from './models';
import type { Handlers } from './protocol';
import { toggleDomain } from './preferences';
import { saveGroup } from './storage';
import { parseTags } from './tags';
import { uaRule, uaRuleId } from './ua';

/** Redirect chains, per tab, for the current worker lifetime. Filled by the webRequest listeners. */
export const redirects = new Map<number, { url: string; statusCode?: number }[]>();

// Session storage, not a Set: the worker is evicted while idle, and losing this would let
// the cleaner close a tab with unsaved form input in it.
const unsavedKey = 'unsavedTabs';
export const unsavedTabs = async () => ((await chrome.storage.session.get(unsavedKey))[unsavedKey] ?? []) as number[];
export const setUnsaved = async (tabId: number, value: boolean) => { const ids = await unsavedTabs(); await chrome.storage.session.set({ [unsavedKey]: value ? [...new Set([...ids, tabId])] : ids.filter(id => id !== tabId) }); };

const uaOverridesKey = 'uaOverrides';
type UaOverride = { windowId: number; domain: string; value: string };
let uaCache: UaOverride[] | null = null;
export const uaOverrides = async () => uaCache ??= ((await chrome.storage.session.get(uaOverridesKey))[uaOverridesKey] ?? []) as UaOverride[];
const setUaOverrides = async (rules: UaOverride[]) => { uaCache = rules; await chrome.storage.session.set({ [uaOverridesKey]: rules }); };

const restoreHistory = async () => ((await chrome.storage.session.get(key.restore))[key.restore] ?? []) as RestoreTab[];
const inWindow = (p: { windowId?: number }, sender: chrome.runtime.MessageSender) => p.windowId ?? sender.tab?.windowId;

export const handlers: Handlers = {
  'unsaved': async (p, sender) => { await setUnsaved(sender.tab!.id!, p.value); },

  'save-tabs': async (p, sender) => {
    const tabs = await chrome.tabs.query({ windowId: inWindow(p, sender) });
    const kept = tabs.filter(t => t.url && !t.url.startsWith('chrome:'));
    const group: TabGroup = { id: crypto.randomUUID(), name: p.name || 'Read later', tags: parseTags(p.tags), tabs: kept.map(tabData), createdAt: Date.now() };
    await saveGroup(group);
    if (p.close && kept.length) await chrome.tabs.remove(kept.map(t => t.id!));
    return group;
  },

  'restore': async (p, sender) => {
    const old = await restoreHistory();
    await chrome.tabs.create({ windowId: inWindow(p, sender), url: p.tab.url, active: false });
    await chrome.storage.session.set({ [key.restore]: old.filter(t => !(t.url === p.tab.url && t.closedAt === p.tab.closedAt)) });
  },

  'redirects': async p => redirects.get(p.tabId) ?? [],

  // Scoped queries rather than getAll({}), which pulls every cookie in the profile across
  // IPC (tens of thousands is normal) to throw almost all of them away. Two passes,
  // because neither filter alone sees everything an inspector should show: `url` finds
  // parent-domain cookies (.example.com on www.example.com) but only at a matching path,
  // and `domain` finds every path on the host but never its parents.
  'cookies': async (p, sender) => {
    const urls = scopedUrls(await chrome.tabs.query({ windowId: inWindow(p, sender) }));
    const found = await Promise.all([
      ...urls.map(url => chrome.cookies.getAll({ url })),
      ...[...new Set(urls.map(domainOf))].map(domain => chrome.cookies.getAll({ domain })),
    ]);
    const seen = new Map<string, chrome.cookies.Cookie>();
    for (const c of found.flat()) seen.set(`${c.domain} ${c.path} ${c.name}`, c);
    return [...seen.values()];
  },

  'import-cookies': async p => {
    for (const c of cookieImport(p.json)) await chrome.cookies.set({ ...c, url: cookieUrl(c) });
  },

  // Editing one cookie is a set over the same name/domain/path, which is why the panel sends
  // the whole record back rather than a patch: chrome.cookies.set replaces, it does not merge.
  'set-cookie': async p => { await chrome.cookies.set(p.cookie); },
  'delete-cookie': async p => { await chrome.cookies.remove({ url: p.url, name: p.name }); },

  'toggle-pref': async p => toggleDomain(p.field, p.domain),

  'ua': async (p, sender) => {
    const windowId = inWindow(p, sender);
    const saved = await uaOverrides();
    await setUaOverrides([...saved.filter(r => !(r.windowId === windowId && r.domain === p.domain)), { windowId: windowId!, domain: p.domain, value: p.value }]);
    const tabs = await chrome.tabs.query({ windowId });
    const ids = tabs.filter(t => t.id && t.url && domainOf(t.url) === p.domain).map(t => t.id!);
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ids.map(uaRuleId), addRules: ids.map(id => uaRule(id, p.value)) });
  },
};
