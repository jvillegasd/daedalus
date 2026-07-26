import { matchesDomain } from '../src/domain';

const invert = 'invert(1) hue-rotate(180deg)';
const darkCss = `html{filter:${invert} !important;background:#fff !important}img,video,picture,canvas,iframe,embed{filter:${invert} !important}`;
const onReady = (fn: () => void) => document.readyState === 'loading' ? addEventListener('DOMContentLoaded', fn, { once: true }) : fn();

export default defineContentScript({ matches: ['<all_urls>'], runAt: 'document_start', main() {
  let dirty = false;
  addEventListener('input', e => { if ((e.target as Element).matches('input,textarea,[contenteditable]') && !dirty) { dirty = true; chrome.runtime.sendMessage({ type: 'unsaved', value: true }); } }, true);
  addEventListener('submit', () => { dirty = false; chrome.runtime.sendMessage({ type: 'unsaved', value: false }); }, true);
  chrome.storage.sync.get('prefs').then(({ prefs }) => {
    const has = (list: string[] = []) => matchesDomain(location.href, list);
    // A stylesheet rather than inline styles: it also covers elements the page adds later,
    // and site scripts can't clobber it the way they clobber documentElement.style.
    if (has(prefs?.darkDomains)) { const s = document.createElement('style'); s.textContent = darkCss; document.documentElement.append(s); }
    // ponytail: userActivation tells autoplay apart from a real click well enough; if a site
    // needs finer control, allowlist it rather than growing a heuristic here.
    if (!has(prefs?.autoplayAllowlist)) addEventListener('play', e => { if (!navigator.userActivation?.hasBeenActive) (e.target as HTMLMediaElement).pause(); }, true);
    if (has(prefs?.consentDomains)) onReady(() => setTimeout(() => [...document.querySelectorAll('button,input[type=button]')].find((b: any) => /reject|decline|necessary only|essential only/i.test(b.textContent || b.value || ''))?.click(), 500));
  });
} });
