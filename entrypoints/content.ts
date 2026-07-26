import { luminance, matchesDomain } from '../src/domain';

const invert = 'invert(1) hue-rotate(180deg)';
const darkCss = `html{filter:${invert} !important;background:#fff !important}img,video,picture,canvas,iframe,embed{filter:${invert} !important}`;
// html/body are transparent on plenty of sites (the theme colour lives on a wrapper), so
// sample what is actually painted at a few points and walk up to the first opaque background.
const bgAt = (x: number, y: number) => { for (let e = document.elementFromPoint(x, y); e; e = e.parentElement) { const l = luminance(getComputedStyle(e).backgroundColor); if (l !== null) return l; } return null; };
const pageLuminance = () => { const w = innerWidth, h = innerHeight; const found = ([[.5, .5], [.15, .3], [.85, .7], [.5, .9]] as const).map(([x, y]) => bgAt(w * x, h * y)).filter(l => l !== null); return found.length ? found.reduce((a, b) => a + b, 0) / found.length : 1; };
const onReady = (fn: () => void) => document.readyState === 'loading' ? addEventListener('DOMContentLoaded', fn, { once: true }) : fn();

export default defineContentScript({ matches: ['<all_urls>'], runAt: 'document_start', main() {
  let dirty = false;
  addEventListener('input', e => { if ((e.target as Element).matches('input,textarea,[contenteditable]') && !dirty) { dirty = true; chrome.runtime.sendMessage({ type: 'unsaved', value: true }); } }, true);
  addEventListener('submit', () => { dirty = false; chrome.runtime.sendMessage({ type: 'unsaved', value: false }); }, true);
  chrome.storage.sync.get('prefs').then(({ prefs }) => {
    const has = (list: string[] = []) => matchesDomain(location.href, list);
    // A stylesheet rather than inline styles: it also covers elements the page adds later,
    // and site scripts can't clobber it the way they clobber documentElement.style.
    // Inverting a site that already ships a dark theme just turns it light, so once the page
    // has rendered, measure its real background (with our rule lifted) and only keep the
    // inversion on light pages. Remove/re-add happen in one task, so nothing flashes.
    if (prefs?.darkEnabled && !has(prefs?.darkExcluded)) {
      const s = document.createElement('style'); s.textContent = darkCss; document.documentElement.append(s);
      onReady(() => { s.remove(); if (pageLuminance() >= 0.4) document.documentElement.append(s); });
    }
    // Playback you asked for starts within milliseconds of a click or keypress; playback a
    // feed starts on its own does not. userActivation.hasBeenActive can't tell them apart on
    // a single-page app — it latches true at your first click and never resets — so track
    // when the last gesture happened instead. ponytail: 1s window, widen it if a site's
    // player is slow enough to get caught.
    if (!has(prefs?.autoplayAllowlist)) {
      let lastGesture = 0;
      const mark = () => { lastGesture = Date.now(); };
      for (const type of ['pointerdown', 'keydown']) addEventListener(type, mark, true);
      addEventListener('play', e => { if (Date.now() - lastGesture > 1000) (e.target as HTMLMediaElement).pause(); }, true);
    }
    if (has(prefs?.consentDomains)) onReady(() => setTimeout(() => [...document.querySelectorAll('button,input[type=button]')].find((b: any) => /reject|decline|necessary only|essential only/i.test(b.textContent || b.value || ''))?.click(), 500));
  });
} });
