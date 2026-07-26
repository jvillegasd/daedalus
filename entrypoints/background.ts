import { addRestore, cookieImport, eligibleForCleaning, reduceRedirect, scopedDomains } from '../src/domain';
import { key, type RestoreTab, type SavedTab, type TabGroup } from '../src/models';
import { prefs, saveGroup } from '../src/storage';
import { uaRule, uaRuleId } from '../src/ua';

const activity = new Map<number, number>();
const unsaved = new Set<number>();
const redirects = new Map<number, { url: string; statusCode?: number }[]>();
const uaOverridesKey = 'uaOverrides';
type UaOverride = { windowId: number; domain: string; value: string };
const tabData = (t: chrome.tabs.Tab): SavedTab => ({ url: t.url!, title: t.title || t.url!, favIconUrl: t.favIconUrl, pinned: t.pinned });

export default defineBackground(() => {
  // ponytail: optional — chrome.sidePanel is absent on browsers that don't ship the API,
  // and an unguarded call here kills the whole service worker on startup.
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.contextMenus.create({ id: 'lens', title: 'Search image with Google Lens', contexts: ['image'] });
  chrome.contextMenus.create({ id: 'bing', title: 'Search image with Bing', contexts: ['image'] });
  chrome.contextMenus.create({ id: 'yandex', title: 'Search image with Yandex', contexts: ['image'] });
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!info.srcUrl || !tab?.windowId) return;
    if (!/^https?:/i.test(info.srcUrl)) { chrome.action.setBadgeText({ tabId: tab.id, text: 'URL' }); return; }
    const map: Record<string, string> = { lens: `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(info.srcUrl)}`, bing: `https://www.bing.com/images/searchbyimage?cbir=sbi&imgurl=${encodeURIComponent(info.srcUrl)}`, yandex: `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(info.srcUrl)}` };
    chrome.tabs.create({ windowId: tab.windowId, url: map[info.menuItemId] });
  });
  chrome.tabs.onActivated.addListener(({ tabId }) => activity.set(tabId, Date.now()));
  chrome.tabs.onCreated.addListener(tab => { if (tab.id) activity.set(tab.id, Date.now()); });
  chrome.tabs.onUpdated.addListener(async (tabId, _, tab) => { if (!tab.url || tab.windowId === undefined) return; const rules = ((await chrome.storage.session.get(uaOverridesKey))[uaOverridesKey] ?? []) as UaOverride[]; const rule = rules.find(r => r.windowId === tab.windowId && r.domain === new URL(tab.url!).hostname); if (rule) chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [uaRuleId(tabId)], addRules: [uaRule(tabId, rule.value)] }); });
  chrome.tabs.onRemoved.addListener(tabId => { activity.delete(tabId); unsaved.delete(tabId); chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [uaRuleId(tabId)] }); });
  chrome.webRequest.onBeforeRequest.addListener(d => { if (d.type === 'main_frame') redirects.set(d.tabId, reduceRedirect(redirects.get(d.tabId) ?? [], d.url)); }, { urls: ['<all_urls>'] });
  chrome.webRequest.onHeadersReceived.addListener(d => { if (d.type === 'main_frame') redirects.set(d.tabId, reduceRedirect(redirects.get(d.tabId) ?? [], d.url, d.statusCode)); }, { urls: ['<all_urls>'] }, ['responseHeaders']);
  chrome.alarms.create('clean-tabs', { periodInMinutes: 5 });
  chrome.alarms.onAlarm.addListener(async a => {
    if (a.name !== 'clean-tabs') return;
    const p = await prefs(); if (!p.cleanerEnabled) return;
    const now = Date.now(), threshold = p.cleanerMinutes * 60_000;
    const tabs = await chrome.tabs.query({});
    const close = tabs.filter(t => eligibleForCleaning(t, p.excludedDomains) && !unsaved.has(t.id!) && now - (activity.get(t.id!) ?? now) >= threshold);
    if (!close.length) return;
    const saved = close.map(tabData); const old = ((await chrome.storage.session.get(key.restore))[key.restore] ?? []) as RestoreTab[];
    await chrome.storage.session.set({ [key.restore]: addRestore(old, saved) });
    await chrome.tabs.remove(close.map(t => t.id!));
  });
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => { (async () => {
    const windowId = message.windowId ?? sender.tab?.windowId;
    if (message.type === 'unsaved') { message.value ? unsaved.add(sender.tab!.id!) : unsaved.delete(sender.tab!.id!); return; }
    if (message.type === 'save-tabs') { const tabs = await chrome.tabs.query({ windowId }); const kept = tabs.filter(t => t.url && !t.url.startsWith('chrome:')); const group: TabGroup = { id: crypto.randomUUID(), name: message.name || 'Read later', tags: (message.tags || '').split(',').map((x: string) => x.trim()).filter(Boolean), tabs: kept.map(tabData), createdAt: Date.now() }; await saveGroup(group); sendResponse(group); if (message.close && kept.length) await chrome.tabs.remove(kept.map(t => t.id!)); }
    if (message.type === 'restore') { const old = ((await chrome.storage.session.get(key.restore))[key.restore] ?? []) as RestoreTab[]; await chrome.tabs.create({ windowId, url: message.tab.url, active: false }); await chrome.storage.session.set({ [key.restore]: old.filter(t => !(t.url === message.tab.url && t.closedAt === message.tab.closedAt)) }); }
    if (message.type === 'redirects') sendResponse(redirects.get(message.tabId) ?? []);
    if (message.type === 'cookies') { const domains = scopedDomains(await chrome.tabs.query({ windowId })); const all = await chrome.cookies.getAll({}); sendResponse(all.filter(c => domains.some(d => c.domain.replace(/^\./, '') === d || d.endsWith(c.domain.replace(/^\./, ''))))); }
    if (message.type === 'import-cookies') { const cookies = cookieImport(message.json); for (const c of cookies) await chrome.cookies.set({ ...c, url: `${c.secure ? 'https' : 'http'}://${c.domain.replace(/^\./, '')}${c.path || '/'}` }); }
    if (message.type === 'toggle-pref') { const p = await prefs(); const list = p[message.field as 'darkExcluded' | 'autoplayAllowlist' | 'consentDomains']; const next = list.includes(message.domain) ? list.filter(d => d !== message.domain) : [...list, message.domain]; await chrome.storage.sync.set({ prefs: { ...p, [message.field]: next } }); sendResponse(next.includes(message.domain)); }
    if (message.type === 'ua') { const saved = ((await chrome.storage.session.get(uaOverridesKey))[uaOverridesKey] ?? []) as UaOverride[]; await chrome.storage.session.set({ [uaOverridesKey]: [...saved.filter(r => !(r.windowId === windowId && r.domain === message.domain)), { windowId, domain: message.domain, value: message.value }] }); const tabs = await chrome.tabs.query({ windowId }); const ids = tabs.filter(t => t.id && t.url && new URL(t.url).hostname === message.domain).map(t => t.id!); await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ids.map(uaRuleId), addRules: ids.map(id => uaRule(id, message.value)) }); }
  })().catch(e => sendResponse({ error: e.message })); return true; });
});
