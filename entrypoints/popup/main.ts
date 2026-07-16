import './style.css';
const $ = (id: string) => document.getElementById(id) as HTMLInputElement;
$('save').onclick = async () => { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); const r = await chrome.runtime.sendMessage({ type: 'save-tabs', windowId: tab.windowId, name: $('name').value, tags: $('tags').value, selected: $('selected').checked, close: true }); $('status').textContent = r.error || `Saved ${r.tabs.length} tabs.`; };
$('open').onclick = () => chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
