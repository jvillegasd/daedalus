import './style.css'; import { groups, removeGroup, setGroups, prefs, savePrefs } from '../../src/storage'; import { key, type RestoreTab, type SavedTab, type TabGroup } from '../../src/models'; import { move } from '../../src/domain'; import { uaProfiles } from '../../src/ua';
const el = (id: string) => document.getElementById(id) as HTMLInputElement;
// Each pair is a button plus the domain list it adds to or removes the current host from.
// 'dark' is an exception list (pressed = skip this site); the other two are allowlists.
const toggles = [['dark', 'darkExcluded'], ['autoplay', 'autoplayAllowlist'], ['consent', 'consentDomains']] as const;
let currentCookies: chrome.cookies.Cookie[] = [];
// The manager runs as a real side panel in Chrome, but as an ordinary tab where the
// sidePanel API is missing (Opera) — there the active tab is this page, so skip our own
// pages and fall back to the most recently used tab.
async function tab() { const tabs = (await chrome.tabs.query({ currentWindow: true })).filter(t => t.url && !t.url.startsWith(location.origin)); return tabs.find(t => t.active) ?? tabs.sort((a, b) => ((b as { lastAccessed?: number }).lastAccessed ?? 0) - ((a as { lastAccessed?: number }).lastAccessed ?? 0))[0]; }
const host = (t?: chrome.tabs.Tab) => { try { return new URL(t!.url!).hostname; } catch { return ''; } };
const show = (caption: string, value: unknown) => { el('caption').textContent = caption; el('inspect').textContent = JSON.stringify(value, null, 2); };
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

async function render() { const list = await groups(); el('groups').innerHTML = list.map(card).join('') || '<p class="hint">No saved lists yet.</p>'; }

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
  const added = input.value.split(',').map(t => t.trim()).filter(t => t && !group.tags.includes(t));
  const patch = input.dataset.act === 'rename'
    ? { name: input.value.trim() || 'Untitled list' }
    : { tags: [...group.tags, ...added] };
  await setGroups(list.map(g => g.id === id ? { ...g, ...patch } : g));
  render();
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
    case 'open-all': for (const t of g.tabs) await chrome.tabs.create({ url: t.url, active: false }); return;
    case 'add-current': { const t = await tab(); if (!t?.url) return; await setGroups(withTabs([...g.tabs, { url: t.url, title: t.title || t.url, favIconUrl: t.favIconUrl, pinned: t.pinned }])); break; }
    case 'tag-remove': { const t = Number(button.dataset.tag); await setGroups(list.map((x, n) => n === gi ? { ...x, tags: x.tags.filter((_, k) => k !== t) } : x)); break; }
    case 'tab-remove': await setGroups(withTabs(g.tabs.filter((_, n) => n !== i))); break;
    case 'tab-up': await setGroups(withTabs(move(g.tabs, i, -1))); break;
    case 'tab-down': await setGroups(withTabs(move(g.tabs, i, 1))); break;
    case 'group-up': await setGroups(move(list, gi, -1)); break;
    case 'group-down': await setGroups(move(list, gi, 1)); break;
    case 'group-remove': if (!confirm(`Delete "${g.name}" and its ${g.tabs.length} tabs?`)) return; await removeGroup(g.id); break;
    default: return;
  }
  render();
};
const escape = (s: string) => s.replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]!));
async function syncTarget() { const p = await prefs(); const domain = host(await tab()); el('target').textContent = domain ? `Acting on ${domain} — applies on next reload.` : 'No page tab found.'; for (const [id, field] of toggles) el(id).setAttribute('aria-pressed', String(p[field].includes(domain))); }
chrome.tabs.onActivated.addListener(() => syncTarget());
chrome.tabs.onUpdated.addListener((_, change) => { if (change.url) syncTarget(); });
el('darkGlobal').onchange = () => savePrefs({ darkEnabled: el('darkGlobal').checked });
(async () => { const p = await prefs(); el('darkGlobal').checked=p.darkEnabled; el('cleaner').checked=p.cleanerEnabled; el('minutes').value=String(p.cleanerMinutes); el('exclude').value=p.excludedDomains.join(','); syncTarget(); render(); })();
el('trace').onclick = async () => { const t = await tab(); show('Redirect chain', await chrome.runtime.sendMessage({ type:'redirects', tabId:t.id })); };
for (const [id, field] of toggles) el(id).onclick = async () => { const t=await tab(); const enabled=await chrome.runtime.sendMessage({type:'toggle-pref', field, domain:host(t)}); el(id).setAttribute('aria-pressed', String(enabled)); };
el('cookies').onclick = async () => { const t=await tab(); currentCookies = await chrome.runtime.sendMessage({ type:'cookies', windowId:t.windowId }); show(`Cookies in this window (${currentCookies.length})`, currentCookies); };
el('ua').onchange = async () => { const t=await tab(), name=el('ua').value as keyof typeof uaProfiles; if(name) await chrome.runtime.sendMessage({ type:'ua', windowId:t.windowId, domain:host(t), value:uaProfiles[name] }); };
el('prefs').onclick = async () => { await savePrefs({ cleanerEnabled:el('cleaner').checked, cleanerMinutes:Number(el('minutes').value)||60, excludedDomains:el('exclude').value.split(',').map(x=>x.trim()).filter(Boolean) }); el('saved').textContent='Saved.'; setTimeout(()=>{ el('saved').textContent=''; }, 2000); };
el('restore').onclick = async () => { const saved=((await chrome.storage.session.get(key.restore))[key.restore]??[]) as RestoreTab[]; if(saved[0]) { const t=await tab(); await chrome.runtime.sendMessage({type:'restore', windowId:t.windowId, tab:saved[0]}); } };
el('export').onclick = () => { el('json').value=JSON.stringify(currentCookies, null, 2); };
el('import').onclick = async () => { if (!confirm('Import overwrites matching cookies in your Chrome profile. Continue?')) return; const r=await chrome.runtime.sendMessage({type:'import-cookies',json:el('json').value}); if(r?.error) alert(r.error); else alert('Imported.'); };
