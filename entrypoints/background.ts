import { runClean } from '../src/cleaner';
import { reduceRedirect } from '../src/redirects';
import { domainOf } from '../src/urls';
import { handlers, redirects, setUnsaved, unsavedTabs, uaOverrides } from '../src/handlers';
import { enterPip } from '../src/pip';
import { handle } from '../src/protocol';
import { uaRule, uaRuleId } from '../src/ua';

export default defineBackground(() => {
  // ponytail: optional — chrome.sidePanel is absent on browsers that don't ship the API,
  // and an unguarded call here kills the whole service worker on startup.
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  // Menus outlive the service worker, so re-creating them on every wake fails with a
  // duplicate-id error. onInstalled is the one place they need creating.
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({ id: 'lens', title: 'Search image with Google Lens', contexts: ['image'] });
      chrome.contextMenus.create({ id: 'bing', title: 'Search image with Bing', contexts: ['image'] });
      chrome.contextMenus.create({ id: 'yandex', title: 'Search image with Yandex', contexts: ['image'] });
      chrome.contextMenus.create({ id: 'pip', title: 'Picture-in-Picture', contexts: ['video', 'page'] });
    });
  });
  // allFrames because the video is as likely to be in an embed as in the top document; the
  // frames without one do nothing.
  const pip = (tabId: number) => chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: enterPip, world: 'MAIN' }).catch(() => {});
  chrome.commands.onCommand.addListener(async (command, tab) => {
    if (command === 'pip' && tab?.id) await pip(tab.id);
  });
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'pip') { if (tab?.id) pip(tab.id); return; }
    if (!info.srcUrl || !tab?.windowId) return;
    // data: and blob: images have no URL a provider could fetch. Say so briefly rather than
    // leaving the badge stuck on the tab forever.
    if (!/^https?:/i.test(info.srcUrl)) { chrome.action.setBadgeText({ tabId: tab.id, text: 'URL' }); setTimeout(() => chrome.action.setBadgeText({ tabId: tab.id, text: '' }), 3000); return; }
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
