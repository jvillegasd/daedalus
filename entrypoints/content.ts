export default defineContentScript({ matches: ['<all_urls>'], runAt: 'document_idle', main() {
  let dirty = false;
  addEventListener('input', e => { if ((e.target as Element).matches('input,textarea,[contenteditable]') && !dirty) { dirty = true; chrome.runtime.sendMessage({ type: 'unsaved', value: true }); } }, true);
  addEventListener('submit', () => { dirty = false; chrome.runtime.sendMessage({ type: 'unsaved', value: false }); }, true);
  chrome.storage.sync.get('prefs').then(({ prefs }) => {
    const host = location.hostname, has = (list: string[] = []) => list.some(d => host === d || host.endsWith(`.${d}`));
    if (has(prefs?.darkDomains)) { document.documentElement.style.filter = 'invert(1) hue-rotate(180deg)'; document.querySelectorAll('img,video,picture,canvas').forEach(e => (e as HTMLElement).style.filter = 'invert(1) hue-rotate(180deg)'); }
    if (!has(prefs?.autoplayAllowlist)) document.querySelectorAll('video,audio').forEach(m => { m.autoplay = false; m.pause(); });
    if (has(prefs?.consentDomains)) requestAnimationFrame(() => [...document.querySelectorAll('button,input[type=button]')].find((b: any) => /reject|decline|necessary only|essential only/i.test(b.textContent || b.value || ''))?.click());
  });
} });
