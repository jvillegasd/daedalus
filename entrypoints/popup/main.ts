import './style.css';
const $ = (id: string) => document.getElementById(id) as HTMLInputElement;
const status = (text: string, error = false) => { $('status').toggleAttribute('data-error', error); $('status').textContent = text; };

// ponytail: resolved up front because sidePanel.open() needs a real window id and an
// unbroken user gesture — awaiting inside the click handler drops the gesture.
let windowId: number | undefined;
chrome.windows.getCurrent().then(w => { windowId = w.id; }, e => status(String(e), true));

$('save').onclick = async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const r = await chrome.runtime.sendMessage({ type: 'save-tabs', windowId: tab.windowId, name: $('name').value, tags: $('tags').value, selected: $('selected').checked, close: true });
    if (!r) throw new Error('No response from background worker.');
    r.error ? status(r.error, true) : status(`Saved ${r.tabs.length} tabs.`);
  } catch (e) { status(String(e), true); }
};

// Chrome closes the popup itself once the panel opens; calling window.close() here
// tears down the page mid-call and the panel never appears.
$('open').onclick = () => {
  // Fallback: browsers without the sidePanel API get the manager as a normal tab.
  if (!chrome.sidePanel) { chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') }); return; }
  if (windowId === undefined) { status('Window id not resolved yet.', true); return; }
  chrome.sidePanel.open({ windowId }).catch(e => status(String(e), true));
};
