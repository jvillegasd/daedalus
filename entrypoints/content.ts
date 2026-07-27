import { luminance } from '../src/appearance';
import { findReject } from '../src/consent';
import { darkCss, pageIsDark, samplePoints, wantsDark } from '../src/dark';
import { activeOn, read } from '../src/preferences';
import { send } from '../src/protocol';

// The verdict for a site, remembered: measuring can only happen once the page has painted,
// so on a site that ships its own dark theme the first load is a visible flash of inverted
// page before the rule is dropped. Remembering it means the second visit never flashes.
// Every load re-measures and corrects the note, so a site that redesigns is not stuck.
// ponytail: one key per host, never pruned. It is a boolean per site you visited with dark
// mode on; add eviction if a profile ever notices the storage.
const darkSiteKey = `darkSite:${location.hostname}`;
const nativelyDark = chrome.storage.local.get(darkSiteKey).then(v => v[darkSiteKey] === true);
// The measuring half, which only a real page can do: walk up from the point to the first
// element with an opaque background. Where to look and what the numbers mean are `dark.ts`'s.
const bgAt = (x: number, y: number) => { for (let e = document.elementFromPoint(x, y); e; e = e.parentElement) { const l = luminance(getComputedStyle(e).backgroundColor); if (l !== null) return l; } return null; };
const sample = () => samplePoints.map(([x, y]) => bgAt(innerWidth * x, innerHeight * y));
const onReady = (fn: () => void) => document.readyState === 'loading' ? addEventListener('DOMContentLoaded', fn, { once: true }) : fn();

export default defineContentScript({ matches: ['<all_urls>'], runAt: 'document_start', main() {
  let dirty = false;
  // `dirty` first: once the flag is set this still fires on every keystroke for the life of
  // the page, and the selector match is the expensive half.
  addEventListener('input', e => { if (!dirty && (e.target as Element).matches('input,textarea,[contenteditable]')) { dirty = true; send('unsaved', { value: true }); } }, true);
  addEventListener('submit', () => { dirty = false; send('unsaved', { value: false }); }, true);
  read().then(prefs => {
    // A stylesheet rather than inline styles: it also covers elements the page adds later,
    // and site scripts can't clobber it the way they clobber documentElement.style.
    // Inverting a site that already ships a dark theme just turns it light, so once the page
    // has rendered, measure its real background (with our rule lifted) and only keep the
    // inversion on light pages. Toggling `disabled` rather than detaching the element keeps
    // the CSS parsed and both flips in one task, so nothing flashes and nothing re-parses.
    if (wantsDark(prefs, location.href, document.contentType)) nativelyDark.then(cached => {
      const s = document.createElement('style'); s.textContent = darkCss(prefs.darkBrightness); s.disabled = cached;
      document.documentElement.append(s);
      onReady(() => {
        s.disabled = true;  // lift our own rule, or the measurement reads it back
        const dark = pageIsDark(sample());
        s.disabled = dark;
        if (dark !== cached) chrome.storage.local.set({ [darkSiteKey]: dark });
      });
    });
    // The blocking itself happens in autoplay.content.ts, which runs in the page's world and
    // can patch HTMLMediaElement. It can't read prefs from there, so hand it the verdict.
    if (activeOn('autoplay', prefs, location.href)) document.documentElement.dataset.daedalusAutoplay = 'block';
    // Consent banners are injected by a third-party script that loads whenever it loads, so
    // one look after DOMContentLoaded misses most of them. Three tries and then give up —
    // a banner that took five seconds to appear was already read.
    if (activeOn('consent', prefs, location.href))
      onReady(() => [500, 1500, 3500].forEach(ms => setTimeout(() => findReject(document)?.click(), ms)));
  });
} });
