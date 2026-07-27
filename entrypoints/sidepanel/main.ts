import './style.css'; import { groups, setGroups } from '../../src/storage'; import { read, toggleDomain, write, type DomainField } from '../../src/preferences'; import { key, type RestoreTab, type SavedTab, type TabGroup } from '../../src/models'; import { move } from '../../src/urls'; import { escape } from '../../src/html'; import { parseTags } from '../../src/tags'; import { send } from '../../src/protocol'; import { uaProfiles } from '../../src/ua'; import { setJs, toggleJs } from '../../src/jsblock'; import { cookieUrl } from '../../src/cookies';
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
const toggles = [['dark', 'darkExcluded'], ['autoplay', 'autoplayAllowlist'], ['consent', 'consentDomains'], ['js', 'jsBlocked']] as const;
let currentCookies: chrome.cookies.Cookie[] = [];
// The manager runs as a real side panel in Chrome, but as an ordinary tab where the
// sidePanel API is missing (Opera) — there the active tab is this page, so skip our own
// pages and fall back to the most recently used tab.
async function tab() { const tabs = (await chrome.tabs.query({ currentWindow: true })).filter(t => t.url && !t.url.startsWith(location.origin)); return tabs.find(t => t.active) ?? tabs.sort((a, b) => ((b as { lastAccessed?: number }).lastAccessed ?? 0) - ((a as { lastAccessed?: number }).lastAccessed ?? 0))[0]; }
const host = (t?: chrome.tabs.Tab) => { try { return new URL(t!.url!).hostname; } catch { return ''; } };
// Pretty-printing a few thousand cookies into one text node is megabytes of string and a
// visible freeze, and nobody scrolls that far. Export still writes the full set.
const shown = 200;
const show = (caption: string, value: unknown) => {
  const long = Array.isArray(value) && value.length > shown;
  el('caption').textContent = long ? `${caption} — showing first ${shown}, export for all` : caption;
  el('inspect').textContent = JSON.stringify(long ? (value as unknown[]).slice(0, shown) : value, null, 2);
};
const item = (t: SavedTab, i: number) => `<li data-i="${i}">
  <button class="link" data-act="open" title="${escape(t.url)}">${escape(t.title)}</button>
  <button class="btn icon" data-act="tab-up" aria-label="Move up">↑</button>
  <button class="btn icon" data-act="tab-down" aria-label="Move down">↓</button>
  <button class="btn icon btn-danger" data-act="tab-remove" aria-label="Remove">✕</button>
</li>`;

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
  <ul>${g.tabs.map(item).join('') || '<li class="hint">Empty list.</li>'}</ul>
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

// Name and tags edit in place: the inputs look like text until hovered or focused, and
// commit on blur/Enter, so there is no edit mode to enter or leave.
el('groups').onchange = async e => {
  const input = (e.target as HTMLElement).closest('input[data-act]') as HTMLInputElement | null;
  if (!input) return;
  const id = (input.closest('article') as HTMLElement).dataset.group;
  const list = await groups();
  const group = list.find(g => g.id === id);
  if (!group) return;
  // One field accepts several tags at once, and adding one you already have is a no-op.
  const added = parseTags(input.value, group.tags);
  const patch = input.dataset.act === 'rename'
    ? { name: input.value.trim() || 'Untitled list' }
    : { tags: [...group.tags, ...added] };
  commit(list.map(g => g.id === id ? { ...g, ...patch } : g));
};

el('groups').onclick = async e => {
  const button = (e.target as HTMLElement).closest('button[data-act]') as HTMLElement | null;
  if (!button) return;
  const list = await groups();
  const gi = list.findIndex(g => g.id === (button.closest('article') as HTMLElement).dataset.group);
  if (gi < 0) return;
  const g = list[gi];
  const i = Number((button.closest('li') as HTMLElement | null)?.dataset.i ?? -1);
  const withTabs = (tabs: SavedTab[]) => list.map((x, n) => n === gi ? { ...x, tabs } : x);

  switch (button.dataset.act) {
    case 'open': return void chrome.tabs.create({ url: g.tabs[i].url });
    case 'open-all': await Promise.all(g.tabs.map(t => chrome.tabs.create({ url: t.url, active: false }))); return;
    case 'add-current': { const t = await tab(); if (!t?.url) return; return commit(withTabs([...g.tabs, { url: t.url, title: t.title || t.url, favIconUrl: t.favIconUrl, pinned: t.pinned }])); }
    case 'tag-remove': { const t = Number(button.dataset.tag); return commit(list.map((x, n) => n === gi ? { ...x, tags: x.tags.filter((_, k) => k !== t) } : x)); }
    case 'tab-remove': return commit(withTabs(g.tabs.filter((_, n) => n !== i)));
    case 'tab-up': return commit(withTabs(move(g.tabs, i, -1)));
    case 'tab-down': return commit(withTabs(move(g.tabs, i, 1)));
    case 'group-up': return commit(move(list, gi, -1));
    case 'group-down': return commit(move(list, gi, 1));
    case 'group-remove': if (!confirm(`Delete "${g.name}" and its ${g.tabs.length} tabs?`)) return; return commit(list.filter(x => x.id !== g.id));
  }
};
// Each feature page carries the container for its own list, so the four lists no longer
// stack into one column where "github.com" under Dark mode reads the same as under JS.
const domainLists = [...document.querySelectorAll<HTMLElement>('.domains')];

async function syncTarget() {
  const p = await read();
  const domain = host(await tab());
  for (const span of document.querySelectorAll<HTMLElement>('[data-host]')) span.textContent = domain || 'no page tab found';
  for (const [id, field] of toggles) el(id).setAttribute('aria-pressed', String(p[field].includes(domain)));
  // The buttons only ever act on the current tab, so each page also lists what its own
  // field already holds — otherwise a rule set on another site is invisible.
  for (const box of domainLists) {
    const field = box.dataset.field as DomainField;
    box.innerHTML = `<span>${escape(box.dataset.label!)} (${p[field].length})</span>
      <div class="tags">${p[field].map(d => `<span class="chip">${escape(d)}<button class="chip-x" data-field="${field}" data-domain="${escape(d)}" aria-label="Remove ${escape(d)}">×</button></span>`).join('') || '<span class="hint">None.</span>'}</div>`;
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
el('darkGlobal').onchange = () => write({ darkEnabled: el('darkGlobal').checked });
el('consentGlobal').onchange = () => write({ consentEnabled: el('consentGlobal').checked });
el('unhook').onchange = () => write({ unhookEnabled: el('unhook').checked });
el('jsonFormat').onchange = () => write({ jsonFormat: el('jsonFormat').checked });
(async () => { const p = await read(); el('darkGlobal').checked=p.darkEnabled; el('consentGlobal').checked=p.consentEnabled; el('unhook').checked=p.unhookEnabled; el('jsonFormat').checked=p.jsonFormat; el('cleaner').checked=p.cleanerEnabled; el('minutes').value=String(p.cleanerMinutes); el('exclude').value=p.excludedDomains.join(','); el('cleanerSave').checked=p.cleanerSave; el('cleanerList').value=p.cleanerListName; syncTarget(); render(); })();
el('trace').onclick = async () => { const t = await tab(); show('Redirect chain', await send('redirects', { tabId: t.id! })); };
// Blocking JavaScript is the one toggle that changes a browser setting rather than a
// preference our own scripts read, and the page has to be reloaded for it to mean anything.
for (const [id, field] of toggles) el(id).onclick = async () => {
  const t = await tab(), domain = host(t);
  if (!domain) return;
  if (field === 'jsBlocked') { await toggleJs(domain); if (t?.id) chrome.tabs.reload(t.id); }
  else await send('toggle-pref', { field, domain });
  syncTarget();
};
const loadCookies = async () => { const t=await tab(); currentCookies = await send('cookies', { windowId: t.windowId }); renderCookies(); return currentCookies; };
el('loadCookies').onclick = () => void loadCookies();
el('ua').onchange = async () => { const t=await tab(), name=el('ua').value as keyof typeof uaProfiles; if(name) await send('ua', { windowId: t.windowId, domain: host(t), value: uaProfiles[name] }); };
el('prefs').onclick = async () => { await write({ cleanerEnabled:el('cleaner').checked, cleanerMinutes:Number(el('minutes').value)||60, cleanerSave:el('cleanerSave').checked, cleanerListName:el('cleanerList').value.trim()||'Auto-saved', excludedDomains:el('exclude').value.split(',').map(x=>x.trim()).filter(Boolean) }); el('saved').textContent='Saved.'; setTimeout(()=>{ el('saved').textContent=''; }, 2000); };
el('restore').onclick = async () => { const saved=((await chrome.storage.session.get(key.restore))[key.restore]??[]) as RestoreTab[]; if(saved[0]) { const t=await tab(); await send('restore', { windowId: t.windowId, tab: saved[0] }); } };
// One row per cookie: the value is the only field worth editing in place, and everything
// else (domain, path, flags) is what identifies the cookie you would be replacing. Edit
// those in the JSON below instead — chrome.cookies.set with a changed key writes a second
// cookie rather than moving the first.
function renderCookies() {
  const list = currentCookies.slice(0, shown);
  el('cookieRows').innerHTML = list.map((c, i) => `<div class="cookie" data-i="${i}">
    <div class="cookie-key"><strong>${escape(c.name)}</strong> <span class="hint">${escape(c.domain)}${escape(c.path)}</span></div>
    <input class="cookie-value" value="${escape(c.value)}" aria-label="Value of ${escape(c.name)}" />
    <button class="btn icon" data-act="save" aria-label="Save ${escape(c.name)}">✔</button>
    <button class="btn icon btn-danger" data-act="delete" aria-label="Delete ${escape(c.name)}">✕</button>
  </div>`).join('') || '<p class="hint">No cookies loaded.</p>';
  if (currentCookies.length > shown) el('cookieRows').insertAdjacentHTML('beforeend', `<p class="hint">Showing first ${shown} of ${currentCookies.length}.</p>`);
}

el('cookieRows').onclick = async e => {
  const button = (e.target as HTMLElement).closest('button[data-act]') as HTMLElement | null;
  if (!button) return;
  const row = button.closest('.cookie') as HTMLElement;
  const c = currentCookies[Number(row.dataset.i)];
  const url = cookieUrl(c);
  try {
    if (button.dataset.act === 'delete') { if (!confirm(`Delete cookie "${c.name}" for ${c.domain}?`)) return; await send('delete-cookie', { url, name: c.name }); }
    else await send('set-cookie', { cookie: { url, name: c.name, value: (row.querySelector('.cookie-value') as HTMLInputElement).value, domain: c.hostOnly ? undefined : c.domain, path: c.path, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite, expirationDate: c.expirationDate } });
    await loadCookies();
  } catch (err) { alert(String(err)); }
};

el('export').onclick = () => { el('json').value=JSON.stringify(currentCookies, null, 2); };
el('import').onclick = async () => { if (!confirm('Import overwrites matching cookies in your Chrome profile. Continue?')) return; try { await send('import-cookies', { json: el('json').value }); alert('Imported.'); } catch (e) { alert(String(e)); } };
