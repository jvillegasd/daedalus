import { runClean } from '../src/cleaner';
import { reduceRedirect } from '../src/redirects';
import { domainOf } from '../src/urls';
import { handlers, redirects, setUnsaved, unsavedTabs, uaOverrides } from '../src/handlers';
import { pipFailed, requestPip } from '../src/pip';
import { handle } from '../src/protocol';
import { uaRule, uaRuleId } from '../src/ua';
import { setupContextMenus } from '../src/context-menus';

export default defineBackground(() => {
  // ponytail: optional — some Chromium browsers expose sidePanel without this method;
  // an unguarded call kills the worker before its menus and listeners are registered.
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true })?.catch(() => {});
  // A reload or browser state restore does not reliably replay onInstalled. Rebuild after every
  // worker start; removeAll makes that safe even when the menus already exist.
  setupContextMenus();
  // Neither of these paths has anywhere to print a sentence, so a failure is a badge for a
  // few seconds — the same way an image with no fetchable URL says so below. Success needs no
  // announcement: the floating window is the announcement.
  const flash = (tabId: number | undefined, text: string) => {
    if (tabId === undefined) return;
    chrome.action.setBadgeText({ tabId, text });
    setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }), 3000);
  };
  const pip = async (tabId: number) => { if (pipFailed(await requestPip(tabId))) flash(tabId, 'PiP'); };
  chrome.commands.onCommand.addListener(async (command, tab) => {
    if (command === 'pip' && tab?.id) await pip(tab.id);
  });
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'pip') { if (tab?.id) pip(tab.id); return; }
    if (!info.srcUrl || !tab?.windowId) return;
    // data: and blob: images have no URL a provider could fetch. Say so briefly rather than
    // leaving the badge stuck on the tab forever.
    if (!/^https?:/i.test(info.srcUrl)) { flash(tab.id, 'URL'); return; }
    const map: Record<string, string> = { lens: `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(info.srcUrl)}`, bing: `https://www.bing.com/images/searchbyimage?cbir=sbi&imgurl=${encodeURIComponent(info.srcUrl)}`, yandex: `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(info.srcUrl)}` };
    chrome.tabs.create({ windowId: tab.windowId, url: map[info.menuItemId] });
  });
  // onUpdated fires several times per navigation (status, title, favicon), so bail on
  // anything that isn't a URL change and keep the overrides in a plain variable. Worker
  // eviction just drops the cache and the next read goes back to session storage.
  chrome.tabs.onUpdated.addListener(async (tabId, change, tab) => {
    if (!change.url || tab.windowId === undefined) return;
    const rule = (await uaOverrides()).find(r => r.windowId === tab.windowId && r.domain === domainOf(change.url!));
    if (rule) chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [uaRuleId(tabId)], addRules: [uaRule(tabId, rule.value)] });
  });
  chrome.tabs.onRemoved.addListener(tabId => { redirects.delete(tabId); setUnsaved(tabId, false); chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [uaRuleId(tabId)] }); });
  // `types` matters: without it Chrome dispatches into this worker for every image, font
  // and XHR on every tab, and the worker never gets to idle. Filtering in the browser
  // process costs nothing. onHeadersReceived reads only statusCode, so it does not ask
  // for 'responseHeaders' — that flag makes Chrome serialise every header block.
  const mainFrameOnly = { urls: ['<all_urls>'], types: ['main_frame'] } as chrome.webRequest.RequestFilter;
  chrome.webRequest.onBeforeRequest.addListener(d => { redirects.set(d.tabId, reduceRedirect(redirects.get(d.tabId) ?? [], d.url)); }, mainFrameOnly);
  chrome.webRequest.onHeadersReceived.addListener(d => { redirects.set(d.tabId, reduceRedirect(redirects.get(d.tabId) ?? [], d.url, d.statusCode)); }, mainFrameOnly);
  // Re-creating an alarm resets its schedule, and this runs on every worker wake.
  chrome.alarms.get('clean-tabs', a => { if (!a) chrome.alarms.create('clean-tabs', { periodInMinutes: 5 }); });
  chrome.alarms.onAlarm.addListener(async a => {
    if (a.name === 'clean-tabs') await runClean(await unsavedTabs());
  });
  handle(handlers);
});
