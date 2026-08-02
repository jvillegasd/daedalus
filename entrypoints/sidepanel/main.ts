import './style.css'; import { createEmptyGroup, groups, setGroups } from '../../src/storage'; import { activeOn, liveField, pressedOn, read, toggleDomain, write, type DomainField, type Scoped } from '../../src/preferences'; import { key, type Preferences, type RestoreTab, type SavedTab, type TabGroup } from '../../src/models'; import { pipMessage, requestPip } from '../../src/pip'; import { apply, type ListAction } from '../../src/lists'; import { targetHost as host, targetTab as tab, toggleSite } from '../../src/surface'; import { escape } from '../../src/html'; import { send } from '../../src/protocol'; import { uaProfiles } from '../../src/ua'; import { setJs, toggleJs } from '../../src/jsblock'; import { addHost, tabData } from '../../src/cleaner'; import { redirectText, type Redirect } from '../../src/redirects'; import { mountCookies } from './cookies';
const el = (id: string) => document.getElementById(id) as HTMLInputElement;

// One section per feature. Wide shows the rail beside the section; narrow shows one or the
// other — `drilled` is that choice, and CSS decides whether it means anything at this width.
// Both stick, so reopening the dashboard lands where you left off.
const views = [...document.querySelectorAll<HTMLElement>('main section')];
const navItems = [...document.querySelectorAll<HTMLElement>('.nav-item')];
function showView(name: string, drilled = true) {
  if (!navItems.some(n => n.dataset.view === name)) name = 'lists';
  views.forEach(v => { v.hidden = v.id !== `view-${name}`; });
  navItems.forEach(n => n.setAttribute('aria-current', String(n.dataset.view === name)));
  document.body.toggleAttribute('data-drilled', drilled);
  el('back').hidden = !drilled;
  localStorage.setItem('view', name);
  localStorage.setItem('drilled', String(drilled));
}
navItems.forEach(n => { n.onclick = () => showView(n.dataset.view!); });
el('back').onclick = () => showView(localStorage.getItem('view') ?? 'lists', false);
showView(localStorage.getItem('view') ?? 'lists', localStorage.getItem('drilled') !== 'false');
// Each pair is a button plus the domain list it adds to or removes the current host from.
// 'dark' is an exception list (pressed = skip this site); the other two are allowlists.
// Three of these resolve through `activeOn`/`liveField`, so which list a click writes to
// depends on the global switch. JavaScript has no global, so it is always its own list.
const toggles = ['dark', 'autoplay', 'consent'] as const;
const item = (t: SavedTab, i: number) => `<li data-i="${i}">
  <button class="link" data-act="open" title="${escape(t.url)}">${escape(t.title)}</button>
  <button class="btn icon" data-act="tab-up" aria-label="Move up">↑</button>
  <button class="btn icon" data-act="tab-down" aria-label="Move down">↓</button>
  <button class="btn icon btn-danger" data-act="tab-remove" aria-label="Remove">✕</button>
</li>`;

// A list shows itself as a card; its tabs are behind the disclosure. render() rebuilds the
// whole container, so which cards are open has to live out here — otherwise reordering a tab
// inside an open list would snap it shut under your cursor.
const opened = new Set<string>();

const card = (g: TabGroup) => `<article data-group="${g.id}">
  <div class="title">
    <input class="name" data-act="rename" value="${escape(g.name)}" aria-label="List name" />
    <span class="count">${g.tabs.length}</span>
    <button class="btn icon" data-act="group-up" aria-label="Move list up">↑</button>
    <button class="btn icon" data-act="group-down" aria-label="Move list down">↓</button>
  </div>
  <div class="tags">
    ${g.tags.map((t, i) => `<span class="chip">${escape(t)}<button class="chip-x" data-act="tag-remove" data-tag="${i}" aria-label="Remove tag ${escape(t)}">×</button></span>`).join('')}
    <input class="tag-add" data-act="tag-add" placeholder="+ tag" aria-label="Add tag" />
  </div>
  <details class="items"${opened.has(g.id) ? ' open' : ''}>
    <summary>Tabs</summary>
    <ul>${g.tabs.map(item).join('') || '<li class="hint">Empty list.</li>'}</ul>
  </details>
  <div class="actions">
    <button class="btn" data-act="open-all">Open all</button>
    <button class="btn" data-act="add-current">Add current tab</button>
    <button class="btn btn-danger" data-act="group-remove">Delete list</button>
  </div>
</article>`;

// Callers that just wrote a list pass it in: re-reading storage to draw what you already
// have in hand means deserialising every saved list twice per click.
// ponytail: still a full innerHTML rebuild. Patch a single <article> if lists get long
// enough that reordering one tab feels slow.
async function render(list?: TabGroup[]) { const all = list ?? await groups(); el('groups').innerHTML = all.map(card).join('') || '<p class="hint">No saved lists yet.</p>'; }
const commit = async (list: TabGroup[]) => { await setGroups(list); render(list); };
el('createList').onclick = async () => { const name = prompt('List name', 'Untitled list'); if (name !== null) { await createEmptyGroup(name); render(); } };
// Read, apply, and write only if it changed: `apply` hands back the same array for a click
// that did nothing — a list deleted in the popup a moment ago, a ↑ on the first tab — and
// re-rendering that would snap the open disclosures shut for no reason.
const change = async (action: ListAction) => {
  const list = await groups();
  const next = apply(list, action);
  if (next !== list) await commit(next);
};
// `toggle` does not bubble, so it is caught on the way down instead.
el('groups').addEventListener('toggle', e => {
  const details = e.target as HTMLDetailsElement;
  const id = (details.closest('article') as HTMLElement | null)?.dataset.group;
  if (!id) return;
  if (details.open) opened.add(id); else opened.delete(id);
}, true);

// Name and tags edit in place: the inputs look like text until hovered or focused, and
// commit on blur/Enter, so there is no edit mode to enter or leave.
el('groups').onchange = async e => {
  const input = (e.target as HTMLElement).closest('input[data-act]') as HTMLInputElement | null;
  if (!input) return;
  const group = (input.closest('article') as HTMLElement).dataset.group!;
  // The raw value goes through: trimming a name and splitting a tag field are `apply`'s
  // rules, not this handler's.
  change(input.dataset.act === 'rename'
    ? { kind: 'rename', group, name: input.value }
    : { kind: 'tag-add', group, input: input.value });
};

el('groups').onclick = async e => {
  const button = (e.target as HTMLElement).closest('button[data-act]') as HTMLElement | null;
  if (!button) return;
  const group = (button.closest('article') as HTMLElement).dataset.group!;
  const index = Number((button.closest('li') as HTMLElement | null)?.dataset.i ?? -1);
  const act = button.dataset.act;

  // The three that are not transitions of the list: two open tabs, and one has to ask before
  // it destroys anything. They are the only ones that need the list itself in hand.
  if (act === 'open' || act === 'open-all' || act === 'group-remove') {
    const g = (await groups()).find(x => x.id === group);
    if (!g) return;
    if (act === 'open') return void chrome.tabs.create({ url: g.tabs[index].url });
    if (act === 'open-all') { await Promise.all(g.tabs.map(t => chrome.tabs.create({ url: t.url, active: false }))); return; }
    if (!confirm(`Delete "${g.name}" and its ${g.tabs.length} tabs?`)) return;
    return change({ kind: 'group-remove', group });
  }

  switch (act) {
    case 'add-current': { const t = await tab(); if (!t?.url) return; return change({ kind: 'append', group, tab: tabData(t) }); }
    case 'tag-remove': return change({ kind: 'tag-remove', group, index: Number(button.dataset.tag) });
    case 'tab-remove': return change({ kind: 'tab-remove', group, index });
    case 'tab-up': return change({ kind: 'tab-move', group, index, by: -1 });
    case 'tab-down': return change({ kind: 'tab-move', group, index, by: 1 });
    case 'group-up': return change({ kind: 'group-move', group, by: -1 });
    case 'group-down': return change({ kind: 'group-move', group, by: 1 });
  }
};
// Each feature page carries the container for its own list, so the four lists no longer
// stack into one column where "github.com" under Dark mode reads the same as under JS.
const domainLists = [...document.querySelectorAll<HTMLElement>('.domains')];

const url = (t?: chrome.tabs.Tab) => t?.url ?? '';
/** What the button offers to do next, given what it is currently doing. */
const verbs = {
  dark: ['Skip dark mode here', 'Use dark mode here'],
  autoplay: ['Allow autoplay here', 'Block autoplay here'],
  consent: ['Allow GDPR banners here', 'Reject GDPR banners here'],
} as const;

async function syncTarget() {
  const p = await read();
  const t = await tab();
  const domain = host(t);
  for (const span of document.querySelectorAll<HTMLElement>('[data-host]')) span.textContent = domain || 'no page tab found';
  // Two different questions, deliberately: the label offers the opposite of what is happening
  // (`activeOn`), while pressed reflects the state the button's name asserts (`pressedOn`).
  // They differ only for autoplay, whose feature is blocking but whose name is not.
  for (const f of toggles) {
    el(f).setAttribute('aria-pressed', String(pressedOn(f, p, url(t))));
    el(f).textContent = verbs[f][activeOn(f, p, url(t)) ? 0 : 1];
  }
  el('js').setAttribute('aria-pressed', String(p.jsBlocked.includes(domain)));
  // Each page lists what its own fields hold — otherwise a rule set on another site is
  // invisible. The list the global has made inert is shown only when it still has entries
  // in it, so the usual case is one list and a stale entry is never stranded.
  for (const box of domainLists) {
    const field = box.dataset.field as DomainField;
    const inert = box.dataset.live !== undefined && liveField(box.dataset.live as Scoped, p) !== field;
    box.hidden = inert && !p[field].length;
    box.classList.toggle('inert', inert);
    box.innerHTML = `<span>${escape(box.dataset.label!)} (${p[field].length})</span>
      <div class="tags">${p[field].map(d => `<span class="chip">${escape(d)}<button class="chip-x" data-field="${field}" data-domain="${escape(d)}" aria-label="Remove ${escape(d)}">×</button></span>`).join('') || '<span class="hint">None.</span>'}</div>
      ${inert ? '<p class="hint">Not in effect while the switch above is set the way it is.</p>' : ''}`;
  }
}

for (const box of domainLists) box.onclick = async e => {
  const button = (e.target as HTMLElement).closest('button[data-field]') as HTMLElement | null;
  if (!button) return;
  // The chip only exists for a domain already in the list, so toggling it is the removal.
  const field = button.dataset.field as DomainField;
  await toggleDomain(field, button.dataset.domain!);
  // The blocklist is a mirror of a browser setting, not the setting itself.
  if (field === 'jsBlocked') await setJs(button.dataset.domain!, false);
  syncTarget();
};
// syncTarget reads prefs and rebuilds the domain chips, and tab events arrive in bursts —
// several per navigation, from every window. Only the tab this panel acts on matters, and
// only its settled state, so coalesce to one refresh per frame.
let queued = 0;
const refresh = () => { cancelAnimationFrame(queued); queued = requestAnimationFrame(() => syncTarget()); };
chrome.tabs.onActivated.addListener(refresh);
chrome.tabs.onUpdated.addListener((_, change, t) => { if (change.url && t.active) refresh(); });
// Every checkbox that is simply one boolean preference, by matching id.
const switches = ['darkGlobal:darkEnabled', 'autoplayGlobal:autoplayEnabled', 'consentGlobal:consentEnabled', 'unhook:unhookEnabled', 'jsonFormat:jsonFormat',
  'unhookFeed:unhookFeed', 'unhookSuggestions:unhookSuggestions', 'unhookEndscreen:unhookEndscreen', 'unhookShorts:unhookShorts'] as const;
for (const pair of switches) {
  const [id, field] = pair.split(':') as [string, keyof Preferences];
  el(id).onchange = () => { write({ [field]: el(id).checked }); if (id === 'unhook') syncSurfaces(); };
}
// The four surfaces do nothing while the master is off, so say so rather than leaving four
// live-looking checkboxes that change nothing.
const syncSurfaces = () => { el('surfaces').toggleAttribute('inert', !el('unhook').checked); el('surfaces').classList.toggle('off', !el('unhook').checked); };

const showBrightness = (v: string) => { el('brightnessOut').textContent = `${v}%`; };
el('brightness').oninput = () => showBrightness(el('brightness').value);
// Committed on release, not per pixel of drag: each write is a chrome.storage.sync round trip.
el('brightness').onchange = () => write({ darkBrightness: Number(el('brightness').value) });

(async () => {
  const p = await read();
  for (const pair of switches) { const [id, field] = pair.split(':') as [string, keyof Preferences]; el(id).checked = p[field] as boolean; }
  el('brightness').value = String(p.darkBrightness); showBrightness(el('brightness').value);
  el('cleaner').checked=p.cleanerEnabled; el('minutes').value=String(p.cleanerMinutes); el('cleanerSave').checked=p.cleanerSave; el('cleanerList').value=p.cleanerListName;
  syncSurfaces(); syncTarget(); renderClosed(); render(); mountCookies();
})();

// Called straight from the panel rather than through the worker: requestPictureInPicture
// needs a user gesture, and a message hop would spend it before the injection happens.
el('pip').onclick = async () => {
  const t = await tab();
  if (!t?.id) return;
  el('pipStatus').textContent = pipMessage(await requestPip(t.id));
};

// The chain, rendered rather than dumped: a status code beside each hop is the whole reason
// to look, and it was buried in JSON. `chain` is kept so Copy has something to format.
let chain: Redirect[] = [];
function renderChain() {
  el('chain').innerHTML = chain.map(r => `<li>
    <span class="code${r.statusCode && r.statusCode >= 300 && r.statusCode < 400 ? ' hop' : ''}">${r.statusCode ?? '···'}</span>
    <span class="url" title="${escape(r.url)}">${escape(r.url)}</span>
  </li>`).join('');
  el('traceStatus').textContent = chain.length ? `${chain.length} hop${chain.length > 1 ? 's' : ''}.` : 'No redirects recorded for this tab — try reloading it, then trace again.';
}
el('trace').onclick = async () => { const t = await tab(); chain = await send('redirects', { tabId: t.id! }); renderChain(); };
el('copyTrace').onclick = async () => {
  await navigator.clipboard.writeText(redirectText(chain));
  el('traceStatus').textContent = 'Copied.';
};
// All four go through `toggleSite`, including the JavaScript one, which is the only toggle
// that writes a browser setting rather than a preference and so has to reload the page.
for (const f of [...toggles, 'js'] as const) el(f).onclick = async () => { if (await toggleSite(f)) syncTarget(); };
el('ua').onchange = async () => { const t=await tab(), name=el('ua').value as keyof typeof uaProfiles; if(name) await send('ua', { windowId: t.windowId, domain: host(t), value: uaProfiles[name] }); };
el('prefs').onclick = async () => { await write({ cleanerEnabled:el('cleaner').checked, cleanerMinutes:Number(el('minutes').value)||60, cleanerSave:el('cleanerSave').checked, cleanerListName:el('cleanerList').value.trim()||'Auto-saved' }); el('saved').textContent='Saved.'; setTimeout(()=>{ el('saved').textContent=''; }, 2000); };
// The exclusion list is its own control now, not a field of the cleaner form: a list you
// edit item by item has nothing to "save", and the old comma-separated string silently
// accepted a pasted URL that then matched nothing.
const addExcluded = async () => {
  const next = addHost((await read()).excludedDomains, el('excludeInput').value);
  await write({ excludedDomains: next });
  el('excludeInput').value = '';
  syncTarget();
};
el('excludeAdd').onclick = addExcluded;
el('excludeInput').onkeydown = e => { if (e.key === 'Enter') addExcluded(); };

// Every tab the cleaner closed this session, not just the newest one. The panel already had
// the whole list in hand and used `saved[0]`; the rest were unreachable.
const closedTabs = async () => ((await chrome.storage.session.get(key.restore))[key.restore] ?? []) as RestoreTab[];
async function renderClosed() {
  const saved = await closedTabs();
  el('closed').innerHTML = saved.map((t, i) => `<li data-i="${i}">
    <button class="link" data-act="reopen" title="${escape(t.url)}">${escape(t.title)}</button>
    <span class="hint">${new Date(t.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
  </li>`).join('') || '<li class="hint">Nothing closed yet.</li>';
}
el('closed').onclick = async e => {
  const button = (e.target as HTMLElement).closest('button[data-act]') as HTMLElement | null;
  if (!button) return;
  const saved = await closedTabs();
  const entry = saved[Number((button.closest('li') as HTMLElement).dataset.i)];
  if (!entry) return;
  const t = await tab();
  // The handler removes the entry it reopened, so re-read rather than patching in place.
  await send('restore', { windowId: t.windowId, tab: entry });
  renderClosed();
};
