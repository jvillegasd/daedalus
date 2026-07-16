import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Daedalus',
    description: 'Local-first tab and page utility.',
    permissions: ['tabs', 'storage', 'sidePanel', 'contextMenus', 'cookies', 'declarativeNetRequest', 'webRequest', 'alarms'],
    host_permissions: ['<all_urls>'],
    incognito: 'not_allowed',
  },
});
