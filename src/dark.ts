import type { Preferences } from './models';
import { activeOn } from './preferences';

const invert = 'invert(1) hue-rotate(180deg)';

/**
 * Invert the page, then re-invert the things that are already the right colour. `picture` is
 * deliberately not in that list: it wraps an `img` this rule already re-inverts, so listing
 * both inverts the same pixels three times and the image comes out washed out or gone.
 * `svg image` is in it because that is a picture drawn without an <img>. A CSS background
 * image is not, and stays inverted on purpose: re-inverting the element that carries one
 * also re-inverts its text and every child, so a hero div would go back to dark-on-dark.
 *
 * Brightness rides on the same html filter, after the inversion, so it acts on the dark
 * result. It only ever dims: `brightness()` is a multiplier and an inverted white page is
 * rgb(0,0,0), so no value can lift the background off black, and inverted black text is
 * already at 255 and clips. Above 100 the only thing that visibly changes is images being
 * blown out, which is why the slider stops there. It is omitted entirely at 100 to keep the
 * default rule byte-identical to what it was.
 *
 * ponytail: media inherits it through the parent filter, so dimming the page dims images
 * too. Divide it back out in the re-invert rule if anyone wants images held at full.
 */
export const darkCss = (brightness: number) => `html{filter:${invert}${brightness === 100 ? '' : ` brightness(${brightness}%)`} !important;background:#fff !important}
img,video,canvas,iframe,embed,svg image{filter:${invert} !important}
input,textarea,select{background-color:inherit !important;color:inherit !important}`;

/**
 * Whether to put the stylesheet on this page at all — decided at document_start, before
 * anything has painted.
 *
 * A JSON response the formatter is about to take over is the one page not to invert: it
 * paints its own dark theme, and it paints it after this script has already measured the
 * background and committed. Two dark modes on one page is the unreadable one.
 */
export const wantsDark = (prefs: Preferences, url: string, contentType: string) =>
  activeOn('dark', prefs, url) && !(prefs.jsonFormat && contentType === 'application/json');

/**
 * Where to look for the page's real background. `html` and `body` are transparent on plenty
 * of sites — the theme colour lives on some wrapper — so sampling one point at the origin
 * finds nothing. Fractions of the viewport, off-centre on purpose: dead centre alone lands
 * inside a hero image or a modal often enough to matter.
 */
export const samplePoints = [[.5, .5], [.15, .3], [.85, .7], [.5, .9]] as const;

/**
 * Whether the page was already dark before we touched it, from luminances sampled at
 * `samplePoints` — nulls for the points that found nothing opaque.
 *
 * Inverting a site that already ships a dark theme just turns it light, so this is the
 * verdict that decides whether the rule stays on. A page that answered nothing anywhere
 * counts as light, which keeps the inversion: the alternative silently does nothing on
 * every page we failed to measure.
 */
export const pageIsDark = (samples: (number | null)[]) => {
  const found = samples.filter((l): l is number => l !== null);
  return (found.length ? found.reduce((a, b) => a + b, 0) / found.length : 1) < 0.4;
};
