import { cookieDetails, cookieMoved, cookieUrl, type CookieEdit } from '../../src/cookies';
import { escape } from '../../src/html';
import { send } from '../../src/protocol';
import { targetHost, targetTab } from '../../src/surface';

const el = (id: string) => document.getElementById(id) as HTMLInputElement;

// Rendering a few thousand cookie rows is a visible freeze, and nobody scrolls that far.
// Export still writes the full set.
const shown = 200;
const sameSites = ['no_restriction', 'lax', 'strict', 'unspecified'] as const;

// The cookies the page is currently showing, kept because a click on a row has to find the
// record it was drawn from. Private to this module rather than a variable the whole manager
// shares with the eight features that never touch it.
let current: chrome.cookies.Cookie[] = [];

// A row per cookie, collapsed to name and address; open one and every field it has is
// editable. It used to be value-only, with a comment sending you to the JSON textarea for
// the rest — the fields are perfectly editable, they just need the old address deleted when
// the edit moves the cookie, which `cookieMoved` decides and the click handler acts on.
function render() {
  el('cookieRows').innerHTML = current.slice(0, shown).map((c, i) => `<details class="cookie" data-i="${i}">
    <summary><strong>${escape(c.name)}</strong> <span class="hint">${escape(c.domain)}${escape(c.path)}</span></summary>
    <label class="field"><span>Value</span><textarea data-f="value" rows="2">${escape(c.value)}</textarea></label>
    <label class="field"><span>Name</span><input data-f="name" value="${escape(c.name)}" /></label>
    <label class="field"><span>Domain</span><input data-f="domain" value="${escape(c.domain)}" ${c.hostOnly ? 'disabled title="Host-only — this cookie is not sent to subdomains."' : ''} /></label>
    <label class="field"><span>Path</span><input data-f="path" value="${escape(c.path)}" /></label>
    <label class="field"><span>SameSite</span><select data-f="sameSite">${sameSites.map(s => `<option ${s === c.sameSite ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    <label class="field-row"><input type="checkbox" data-f="secure" ${c.secure ? 'checked' : ''} /> Secure</label>
    <label class="field-row"><input type="checkbox" data-f="httpOnly" ${c.httpOnly ? 'checked' : ''} /> HttpOnly</label>
    <div class="row">
      <button class="btn btn-primary" data-act="save" type="button">Save</button>
      <button class="btn btn-danger" data-act="delete" type="button">Delete</button>
    </div>
  </details>`).join('') || '<p class="hint">No cookies loaded.</p>';
  if (current.length > shown) el('cookieRows').insertAdjacentHTML('beforeend', `<p class="hint">Showing first ${shown} of ${current.length}. Export writes all of them.</p>`);
}

const load = async () => {
  const t = await targetTab();
  current = await send('cookies', { windowId: t?.windowId });
  const domains = new Set(current.map(c => c.domain.replace(/^\./, '')));
  el('cookieScope').textContent = `${current.length} cookies across ${domains.size} domain${domains.size === 1 ? '' : 's'} open in this window.`;
  render();
};

/** The open row's inputs, read back as the record `chrome.cookies.set` wants. */
const readEdit = (row: HTMLElement, c: chrome.cookies.Cookie): CookieEdit => {
  const f = (name: string) => row.querySelector(`[data-f="${name}"]`) as HTMLInputElement;
  return {
    name: f('name').value.trim(), value: f('value').value,
    domain: c.hostOnly ? c.domain : f('domain').value.trim(),
    path: f('path').value.trim() || '/',
    secure: f('secure').checked, httpOnly: f('httpOnly').checked,
    sameSite: f('sameSite').value as chrome.cookies.SameSiteStatus,
    expirationDate: c.expirationDate, hostOnly: c.hostOnly,
  };
};

/** Wire up the cookie page. Called once, by the manager, on load. */
export function mountCookies() {
  el('loadCookies').onclick = () => void load();

  el('cookieRows').onclick = async e => {
    const button = (e.target as HTMLElement).closest('button[data-act]') as HTMLElement | null;
    if (!button) return;
    const row = button.closest('.cookie') as HTMLElement;
    const c = current[Number(row.dataset.i)];
    try {
      if (button.dataset.act === 'delete') {
        if (!confirm(`Delete cookie "${c.name}" for ${c.domain}?`)) return;
        await send('delete-cookie', { url: cookieUrl(c), name: c.name });
      } else {
        const edit = readEdit(row, c);
        if (!edit.name) return alert('A cookie needs a name.');
        await send('set-cookie', { cookie: cookieDetails(edit) });
        // set() keys on domain+path+name and replaces rather than moves, so an edit to any of
        // those three has just written a second cookie. Remove the one it was copied from.
        if (cookieMoved(c, edit)) await send('delete-cookie', { url: cookieUrl(c), name: c.name });
      }
      await load();
    } catch (err) { alert(String(err)); }
  };

  el('addCookie').onclick = async () => {
    const domain = targetHost(await targetTab());
    if (!domain) return alert('No page tab to add a cookie for.');
    const name = prompt(`Cookie name for ${domain}?`)?.trim();
    if (!name) return;
    try {
      await send('set-cookie', { cookie: cookieDetails({ name, value: '', domain, path: '/', secure: false, httpOnly: false }) });
      await load();
    } catch (err) { alert(String(err)); }
  };

  el('deleteAll').onclick = async () => {
    if (!current.length) return;
    if (!confirm(`Delete all ${current.length} cookies shown? This signs you out of these sites.`)) return;
    for (const c of current) await send('delete-cookie', { url: cookieUrl(c), name: c.name });
    await load();
  };

  el('export').onclick = () => { el('json').value = JSON.stringify(current, null, 2); };
  el('import').onclick = async () => {
    if (!confirm('Import overwrites matching cookies in your Chrome profile. Continue?')) return;
    try { await send('import-cookies', { json: el('json').value }); alert('Imported.'); } catch (e) { alert(String(e)); }
  };
}
