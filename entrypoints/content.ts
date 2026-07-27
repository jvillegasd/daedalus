import { luminance } from '../src/appearance';
import { findReject } from '../src/consent';
import { matchesDomain } from '../src/urls';
import { read } from '../src/preferences';
import { send } from '../src/protocol';

const invert = 'invert(1) hue-rotate(180deg)';
// Invert the page, then re-invert the things that are already the right colour. `picture` is
// deliberately not in that list: it wraps an `img` this rule already re-inverts, so listing
// both inverts the same pixels three times and the image comes out washed out or gone.
// `svg image` is in it because that is a picture drawn without an <img>. A CSS background
// image is not, and stays inverted on purpose: re-inverting the element that carries one
// also re-inverts its text and every child, so a hero div would go back to dark-on-dark.
// Brightness rides on the same html filter, after the inversion, so it acts on the dark
// result: below 100 dims the page, above lifts it. It is omitted entirely at 100 to keep the
// default rule byte-identical to what it was.
// ponytail: media inherits it through the parent filter, so dimming the page dims images
// too. Divide it back out in the re-invert rule if anyone wants images held at full.
const darkCss = (brightness: number) => `html{filter:${invert}${brightness === 100 ? '' : ` brightness(${brightness}%)`} !important;background:#fff !important}
img,video,canvas,iframe,embed,svg image{filter:${invert} !important}
input,textarea,select{background-color:inherit !important;color:inherit !important}`;
// The verdict for a site, remembered: measuring can only happen once the page has painted,
// so on a site that ships its own dark theme the first load is a visible flash of inverted
// page before the rule is dropped. Remembering it means the second visit never flashes.
// Every load re-measures and corrects the note, so a site that redesigns is not stuck.
// ponytail: one key per host, never pruned. It is a boolean per site you visited with dark
// mode on; add eviction if a profile ever notices the storage.
const darkSiteKey = `darkSite:${location.hostname}`;
const nativelyDark = chrome.storage.local.get(darkSiteKey).then(v => v[darkSiteKey] === true);
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
    // A JSON response the formatter is about to take over is the one page not to invert: it
    // paints its own dark theme, and it paints it after this script has already measured the
    // background and committed. Two dark modes on one page is the unreadable one.
    const formattedJson = prefs.jsonFormat && document.contentType === 'application/json';
    if (prefs.darkEnabled && !has(prefs.darkExcluded) && !formattedJson) nativelyDark.then(cached => {
      const s = document.createElement('style'); s.textContent = darkCss(prefs.darkBrightness); s.disabled = cached;
      document.documentElement.append(s);
      onReady(() => {
        s.disabled = true;  // lift our own rule, or the measurement reads it back
        const dark = pageLuminance() < 0.4;
        s.disabled = dark;
        if (dark !== cached) chrome.storage.local.set({ [darkSiteKey]: dark });
      });
    });
    // The blocking itself happens in autoplay.content.ts, which runs in the page's world and
    // can patch HTMLMediaElement. It can't read prefs from there, so hand it the verdict.
    if (prefs.autoplayEnabled && !has(prefs.autoplayAllowlist)) document.documentElement.dataset.daedalusAutoplay = 'block';
    // Consent banners are injected by a third-party script that loads whenever it loads, so
    // one look after DOMContentLoaded misses most of them. Three tries and then give up —
    // a banner that took five seconds to appear was already read.
    if (prefs.consentEnabled || has(prefs.consentDomains))
      onReady(() => [500, 1500, 3500].forEach(ms => setTimeout(() => findReject(document)?.click(), ms)));
  });
} });
