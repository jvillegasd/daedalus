import { toggleJs } from './jsblock';
import { liveField, read, type Scoped } from './preferences';
import { send } from './protocol';
import { domainOf } from './urls';

/**
 * The tab a surface is acting on. Never our own pages: the manager runs as a real side panel
 * in Chrome, but as an ordinary tab where the sidePanel API is missing (Opera), and there the
 * active tab is the manager itself. The most recently used page tab is the answer in that
 * case, and it is also the answer for a popup — where the active tab is the page anyway, so
 * neither the filter nor the fallback ever fires.
 */
export const targetTab = async () => {
  const tabs = (await chrome.tabs.query({ currentWindow: true })).filter(t => t.url && !t.url.startsWith(location.origin));
  return tabs.find(t => t.active)
    ?? tabs.sort((a, b) => ((b as { lastAccessed?: number }).lastAccessed ?? 0) - ((a as { lastAccessed?: number }).lastAccessed ?? 0))[0];
};

export const targetHost = (t?: chrome.tabs.Tab) => domainOf(t?.url ?? '');

/**
 * Flip one of the four per-site switches for the tab the surface is acting on. Resolves false
 * when there is no page tab to act on, so a caller can skip the re-render it would otherwise
 * do for nothing.
 *
 * JavaScript is the odd one: it writes a Chrome content setting rather than a preference our
 * own scripts read, so the page has to be reloaded for the flip to mean anything. The other
 * three go through the worker, and which list they write to depends on the global switch —
 * see `liveField`.
 */
export const toggleSite = async (feature: Scoped | 'js') => {
  const t = await targetTab();
  const domain = targetHost(t);
  if (!domain) return false;
  if (feature === 'js') {
    await toggleJs(domain);
    if (t?.id) chrome.tabs.reload(t.id);
    return true;
  }
  await send('toggle-pref', { field: liveField(feature, await read()), domain });
  return true;
};
