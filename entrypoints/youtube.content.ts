import { read } from '../src/preferences';

// A stylesheet, not DOM removal: YouTube is a single-page app that rebuilds these sections
// on every navigation, so anything deleted comes straight back and a MutationObserver would
// be re-running selectors for the life of the tab. CSS keeps applying for free.
// One chunk per surface, so wanting the feed back but not the Shorts shelves is a checkbox
// rather than a fork. The notice rides with the feed: it exists to fill the column the feed
// left empty, and without it makes no sense.
const surfaces = {
  unhookFeed: `
/* Home feed, and something other than a blank column left in its place */
ytd-browse[page-subtype="home"] #contents.ytd-rich-grid-renderer,
ytd-browse[page-subtype="home"] ytd-rich-section-renderer { display: none !important; }
ytd-browse[page-subtype="home"] #primary::after {
  content: "Feed hidden by Daedalus. Search still works.";
  display: block; padding: 4rem 0; text-align: center; opacity: .5;
}`,
  unhookSuggestions: `
/* Suggestions beside the player */
#related, ytd-watch-next-secondary-results-renderer { display: none !important; }`,
  unhookEndscreen: `
/* The end-screen grid over the video, and the cards and pause overlay with it */
.ytp-endscreen-content, .ytp-ce-element, .ytp-pause-overlay { display: none !important; }`,
  unhookShorts: `
/* Shorts: shelves, the dedicated page, and its rail entry */
ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts],
ytd-guide-entry-renderer:has(a[title="Shorts"]),
ytd-mini-guide-entry-renderer[aria-label="Shorts"] { display: none !important; }`,
} as const;

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_start',
  async main() {
    const prefs = await read();
    if (!prefs.unhookEnabled) return;
    const css = Object.entries(surfaces).filter(([k]) => prefs[k as keyof typeof surfaces]).map(([, v]) => v).join('');
    if (!css) return;
    const style = document.createElement('style');
    style.textContent = css;
    // document_start can beat <head> into existence; documentElement always exists by then.
    document.documentElement.append(style);
  },
});
