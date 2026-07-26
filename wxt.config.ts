import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Daedalus',
    description: 'Local-first tab management, page controls, cookie inspection, redirect tracing, and session-scoped UA headers.',
    icons: { '16': 'icons/icon-16.png', '32': 'icons/icon-32.png', '48': 'icons/icon-48.png', '128': 'icons/icon-128.png' },
    permissions: ['tabs', 'storage', 'sidePanel', 'contextMenus', 'cookies', 'declarativeNetRequest', 'webRequest', 'alarms'],
    host_permissions: ['<all_urls>'],
    incognito: 'not_allowed',
    // Same page, three ways in: side panel, "Extension options", and the popup's fallback tab.
    options_ui: { page: 'sidepanel.html', open_in_tab: true },
  },
});
