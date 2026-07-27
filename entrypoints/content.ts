import { luminance } from '../src/appearance';
import { matchesDomain } from '../src/urls';
import { read } from '../src/preferences';
import { send } from '../src/protocol';

const invert = 'invert(1) hue-rotate(180deg)';
const darkCss = `html{filter:${invert} !important;background:#fff !important}img,video,picture,canvas,iframe,embed{filter:${invert} !important}`;
// html/body are transparent on plenty of sites (the theme colour lives on a wrapper), so
// sample what is actually painted at a few points and walk up to the first opaque background.
const bgAt = (x: number, y: number) => { for (let e = document.elementFromPoint(x, y); e; e = e.parentElement) { const l = luminance(getComputedStyle(e).backgroundColor); if (l !== null) return l; } return null; };
const pageLuminance = () => { const w = innerWidth, h = innerHeight; const found = ([[.5, .5], [.15, .3], [.85, .7], [.5, .9]] as const).map(([x, y]) => bgAt(w * x, h * y)).filter(l => l !== null); return found.length ? found.reduce((a, b) => a + b, 0) / found.length : 1; };
const onReady = (fn: () => void) => document.readyState === 'loading' ? addEventListener('DOMContentLoaded', fn, { once: true }) : fn();

export default defineContentScript({ matches: ['<all_urls>'], runAt: 'document_start', main() {
  let dirty = false;
  // `dirty` first: once the flag is set this still fires on every keystroke for the life of
  // the page, and the selector match is the expensive half.
  addEventListener('input', e => { if (!dirty && (e.target as Element).matches('input,textarea,[contenteditable]')) { dirty = true; send('unsaved', { value: true }); } }, true);
  addEventListener('submit', () => { dirty = false; send('unsaved', { value: false }); }, true);
  read().then(prefs => {
    const has = (list: string[]) => matchesDomain(location.href, list);
    // A stylesheet rather than inline styles: it also covers elements the page adds later,
    // and site scripts can't clobber it the way they clobber documentElement.style.
    // Inverting a site that already ships a dark theme just turns it light, so once the page
    // has rendered, measure its real background (with our rule lifted) and only keep the
    // inversion on light pages. Toggling `disabled` rather than detaching the element keeps
    // the CSS parsed and both flips in one task, so nothing flashes and nothing re-parses.
    if (prefs.darkEnabled && !has(prefs.darkExcluded)) {
      const s = document.createElement('style'); s.textContent = darkCss; document.documentElement.append(s);
      onReady(() => { s.disabled = true; s.disabled = pageLuminance() < 0.4; });
    }
    // The blocking itself happens in autoplay.content.ts, which runs in the page's world and
    // can patch HTMLMediaElement. It can't read prefs from there, so hand it the verdict.
    if (!has(prefs.autoplayAllowlist)) document.documentElement.dataset.daedalusAutoplay = 'block';
    if (has(prefs.consentDomains)) onReady(() => setTimeout(() => [...document.querySelectorAll('button,input[type=button]')].find((b: any) => /reject|decline|necessary only|essential only/i.test(b.textContent || b.value || ''))?.click(), 500));
  });
} });
