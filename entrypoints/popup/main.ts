import './style.css';
import { createEmptyGroup, groups, setGroups } from '../../src/storage';
import type { SavedTab, TabGroup } from '../../src/models';
import { apply } from '../../src/lists';
import { escape } from '../../src/html';
import { send } from '../../src/protocol';
import { parseTags } from '../../src/tags';
import { pressedOn, read } from '../../src/preferences';
import { targetHost, targetTab, toggleSite } from '../../src/surface';
import { tabData } from '../../src/cleaner';
const $ = (id: string) => document.getElementById(id) as HTMLInputElement;
const status = (text: string, error = false) => { $('status').toggleAttribute('data-error', error); $('status').textContent = text; };

// ponytail: resolved up front because sidePanel.open() needs a real window id and an
// unbroken user gesture — awaiting inside the click handler drops the gesture.
let windowId: number | undefined;
chrome.windows.getCurrent().then(w => { windowId = w.id; }, e => status(String(e), true));

// The four per-site switches, on the page you are looking at. The manager owns everything
// else about them — the lists, the master switches, the options — so this shares its rule
// (toggleDomain) rather than a second copy of it, and pressed means the same thing here:
// the current host is in that field's list.
const siteToggles = ['dark', 'autoplay', 'consent'] as const;
// Shared with the manager: in a popup the active tab is always the page, so the extra filter
// and fallback `targetTab` carries for the manager's tab mode never fire here.
const activeTab = targetTab, hostOf = targetHost;

async function syncSite() {
  const t = await activeTab();
  const domain = hostOf(t);
  $('siteHost').textContent = domain || 'No page tab';
  const p = await read();
  // Pressed means the state the label names — see pressedOn, which is why autoplay lit reads
  // as "autoplay plays". It used to mean "this host is in one particular list", which said
  // nothing at all once the global switch made that list inert.
  for (const f of siteToggles) $(f).setAttribute('aria-pressed', String(pressedOn(f, p, t?.url ?? '')));
  $('js').setAttribute('aria-pressed', String(p.jsBlocked.includes(domain)));
  for (const id of [...siteToggles, 'js']) $(id).toggleAttribute('disabled', !domain);
}
for (const f of [...siteToggles, 'js'] as const) $(f).onclick = async () => { if (await toggleSite(f)) syncSite(); };
syncSite();

// Tags collect as chips, same as the manager. The input element is kept across renders so
// typing is never interrupted; only the chips before it are replaced.
const tags: string[] = [];
function renderTags() {
  $('tags').querySelectorAll('.chip').forEach(c => c.remove());
  $('tagInput').insertAdjacentHTML('beforebegin', tags.map((t, i) => `<span class="chip">${escape(t)}<button class="chip-x" data-i="${i}" aria-label="Remove ${escape(t)}">×</button></span>`).join(''));
}
function commitTags() {
  tags.push(...parseTags($('tagInput').value, tags));
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
    const group = await send('save-tabs', { windowId: tab.windowId, name: $('name').value, tags: tags.join(','), close });
    status(`Saved ${group.tabs.length} tabs.`);
    await renderGroups();
    showTab('lists');
  } catch (e) { status(String(e), true); }
};
$('save').onclick = save(false);
$('saveClose').onclick = save(true);

// Saved lists, read-mostly: a grid of square tiles, one per list, that opens into that
// list's tabs. Renaming, tags and reordering stay in the manager, where there is room.
let openId: string | null = null;

async function renderGroups(list?: TabGroup[]) {
  const all = list ?? await groups();
  const open = all.find(g => g.id === openId);
  openId = open?.id ?? null;  // the open list may have just been deleted
  $('groups').innerHTML = open ? detail(open) : tiles(all);
}

const tiles = (all: TabGroup[]) => `<div class="tiles">
  <button class="tile create-list" data-act="create-list" type="button">
    <span class="tile-count" aria-hidden="true">＋</span>
    <span class="tile-name">Create empty list</span>
  </button>${all.map(g => `
  <button class="tile" data-act="open-list" data-id="${g.id}" type="button" title="${escape(g.name)}">
    <span class="tile-count">${g.tabs.length}</span>
    <span class="tile-name">${escape(g.name)}</span>
  </button>`).join('')}</div>`;

const detail = (g: TabGroup) => `<div class="detail-head">
    <button class="btn icon" data-act="back" type="button" aria-label="Back to lists">←</button>
    <span class="detail-name">${escape(g.name)}</span>
    <span class="count">${g.tabs.length}</span>
  </div>
  <ul>${g.tabs.map((t, i) => `<li><button class="link" data-act="item" data-i="${i}" type="button">${escape(t.title)}</button></li>`).join('') || '<li class="hint">Empty list.</li>'}</ul>
  <div class="row">
    <button class="btn" data-act="open-all" type="button">Open all</button>
    <button class="btn" data-act="add-current" type="button">Add current tab</button>
  </div>`;
// Deleting a whole list stays in the manager: it is the destructive one, and the popup is
// a place you land on by accident.

// A tapped tab gets a popover instead of a row of icons: the full title needs the width,
// and three buttons per row is what made the old list feel cramped.
// ponytail: native popover — light dismiss and top-layer stacking come free, so the only
// thing left to do by hand is placing it over the row that was clicked.
let popIndex = -1;
// Light dismiss fires on pointerdown, so by the time the click lands on the same row the
// popover is already closed and would just reopen. Remember what was open a moment ago,
// and treat a second click on that row as the close.
let dismissed = -1;
document.addEventListener('pointerdown', () => { dismissed = $('pop').matches(':popover-open') ? popIndex : -1; }, true);

function openPopover(button: HTMLElement, tab: SavedTab, i: number) {
  if (dismissed === i) { popIndex = -1; return; }
  popIndex = i;
  $('popTitle').textContent = tab.title;
  $('popUrl').textContent = tab.url;
  const rect = button.getBoundingClientRect();
  const pop = $('pop');
  pop.style.top = '0';
  pop.showPopover();
  // Measured after showing, because a hidden popover has no height: rows near the bottom
  // flip the panel above the row rather than hanging off the popup.
  const height = pop.offsetHeight;
  const below = rect.bottom + 4;
  pop.style.top = `${Math.round(below + height > innerHeight ? Math.max(4, rect.top - height - 4) : below)}px`;
}

$('groups').onclick = async e => {
  const button = (e.target as HTMLElement).closest('button[data-act]') as HTMLElement | null;
  if (!button) return;
  const act = button.dataset.act;
  if (act === 'create-list') {
    const name = prompt('List name', 'Untitled list');
    if (name === null) return;
    try {
      await createEmptyGroup(name);
      status('Created empty list.');
      await renderGroups();
    } catch (e) { status(String(e), true); }
    return;
  }
  if (act === 'add-current') {
    button.toggleAttribute('disabled', true);
    try {
      const [list, t] = await Promise.all([groups(), activeTab()]);
      if (!t?.url) return status('No page tab to save.', true);
      const g = list.find(g => g.id === openId);
      if (!g) { await renderGroups(list); return status('List no longer exists.', true); }
      const next = apply(list, { kind: 'append', group: g.id, tab: tabData(t) });
      if (next === list) return status('Already saved.');
      await setGroups(next);
      status('Added current tab.');
      return renderGroups(next);
    } catch (e) { return status(String(e), true); }
    finally { button.toggleAttribute('disabled', false); }
  }
  const list = await groups();
  if (act === 'open-list') { openId = button.dataset.id!; return renderGroups(list); }
  if (act === 'back') { openId = null; return renderGroups(list); }
  const g = list.find(x => x.id === openId);
  if (!g) return;
  switch (act) {
    case 'item': return openPopover(button, g.tabs[Number(button.dataset.i)], Number(button.dataset.i));
    case 'open-all': return void await Promise.all(g.tabs.map(t => chrome.tabs.create({ url: t.url, active: false })));
  }
};

$('pop').onclick = async e => {
  const act = (e.target as HTMLElement).closest('button[data-act]')?.getAttribute('data-act');
  if (!act) return;
  const list = await groups();
  const g = list.find(x => x.id === openId);
  if (!g || !g.tabs[popIndex]) return;
  $('pop').hidePopover();
  if (act === 'pop-open') return void chrome.tabs.create({ url: g.tabs[popIndex].url });
  // The same rule the manager removes a tab with — this used to be a second copy of it.
  const next = apply(list, { kind: 'tab-remove', group: g.id, index: popIndex });
  if (next === list) return;
  await setGroups(next);
  renderGroups(next);
};

renderGroups();

// Two panes: saving the current window, and the lists already saved. A save switches to
// Lists so the result is visible instead of silently landing behind the other tab.
const tabs = [...document.querySelectorAll<HTMLElement>('.seg-tab')];
function showTab(name: string) {
  tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  for (const t of tabs) (document.getElementById(`tab-${t.dataset.tab}`) as HTMLElement).hidden = t.dataset.tab !== name;
}
tabs.forEach(t => { t.onclick = () => showTab(t.dataset.tab!); });

// Chrome closes the popup itself once the panel opens; calling window.close() here
// tears down the page mid-call and the panel never appears.
$('open').onclick = () => {
  // Fallback: browsers without the sidePanel API get the manager as a normal tab.
  if (!chrome.sidePanel) { chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') }); return; }
  if (windowId === undefined) { status('Window id not resolved yet.', true); return; }
  chrome.sidePanel.open({ windowId }).catch(e => status(String(e), true));
};
