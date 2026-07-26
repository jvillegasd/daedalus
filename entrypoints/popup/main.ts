import './style.css';
const $ = (id: string) => document.getElementById(id) as HTMLInputElement;
const status = (text: string, error = false) => { $('status').toggleAttribute('data-error', error); $('status').textContent = text; };

// ponytail: resolved up front because sidePanel.open() needs a real window id and an
// unbroken user gesture — awaiting inside the click handler drops the gesture.
let windowId: number | undefined;
chrome.windows.getCurrent().then(w => { windowId = w.id; }, e => status(String(e), true));

// Tags collect as chips, same as the manager. The input element is kept across renders so
// typing is never interrupted; only the chips before it are replaced.
const tags: string[] = [];
const escape = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
function renderTags() {
  $('tags').querySelectorAll('.chip').forEach(c => c.remove());
  $('tagInput').insertAdjacentHTML('beforebegin', tags.map((t, i) => `<span class="chip">${escape(t)}<button class="chip-x" data-i="${i}" aria-label="Remove ${escape(t)}">×</button></span>`).join(''));
}
function commitTags() {
  for (const t of $('tagInput').value.split(',').map(x => x.trim())) if (t && !tags.includes(t)) tags.push(t);
  $('tagInput').value = '';
  renderTags();
}
$('tagInput').onchange = commitTags;
$('tags').onclick = e => {
  const button = (e.target as HTMLElement).closest('button[data-i]') as HTMLElement | null;
  if (!button) return;
  tags.splice(Number(button.dataset.i), 1);
  renderTags();
};

const save = (close: boolean) => async () => {
  try {
    commitTags();  // a tag typed but not yet entered still counts
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const r = await chrome.runtime.sendMessage({ type: 'save-tabs', windowId: tab.windowId, name: $('name').value, tags: tags.join(','), close });
    if (!r) throw new Error('No response from background worker.');
    r.error ? status(r.error, true) : status(`Saved ${r.tabs.length} tabs.`);
  } catch (e) { status(String(e), true); }
};
$('save').onclick = save(false);
$('saveClose').onclick = save(true);

// Chrome closes the popup itself once the panel opens; calling window.close() here
// tears down the page mid-call and the panel never appears.
$('open').onclick = () => {
  // Fallback: browsers without the sidePanel API get the manager as a normal tab.
  if (!chrome.sidePanel) { chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') }); return; }
  if (windowId === undefined) { status('Window id not resolved yet.', true); return; }
  chrome.sidePanel.open({ windowId }).catch(e => status(String(e), true));
};
