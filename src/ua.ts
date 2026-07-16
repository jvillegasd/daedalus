export const uaProfiles = {
  'Chrome Android': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  'Firefox Linux': 'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
} as const;
export const uaRuleId = (tabId: number) => 100000 + tabId;
export const uaRule = (tabId: number, value: string): chrome.declarativeNetRequest.Rule => ({ id: uaRuleId(tabId), priority: 1, action: { type: 'modifyHeaders', requestHeaders: [{ header: 'user-agent', operation: 'set', value }] }, condition: { tabIds: [tabId], resourceTypes: ['main_frame'] } });
