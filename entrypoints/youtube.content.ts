import { read } from '../src/preferences';

// A stylesheet, not DOM removal: YouTube is a single-page app that rebuilds these sections
// on every navigation, so anything deleted comes straight back and a MutationObserver would
// be re-running selectors for the life of the tab. CSS keeps applying for free.
// ponytail: one switch for the lot. Split into per-surface toggles if anyone wants the feed
// back but not the Shorts shelves.
const css = `
/* Home feed */
ytd-browse[page-subtype="home"] #contents.ytd-rich-grid-renderer,
ytd-browse[page-subtype="home"] ytd-rich-section-renderer { display: none !important; }
/* Suggestions beside the player, and the end-screen grid over it */
#related, ytd-watch-next-secondary-results-renderer,
.ytp-endscreen-content, .ytp-ce-element, .ytp-pause-overlay { display: none !important; }
/* Shorts: shelves, the dedicated page, and its rail entry */
ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts],
ytd-guide-entry-renderer:has(a[title="Shorts"]),
ytd-mini-guide-entry-renderer[aria-label="Shorts"] { display: none !important; }
/* Something has to be left on the home page other than a blank column */
ytd-browse[page-subtype="home"] #primary::after {
  content: "Feed hidden by Daedalus. Search still works.";
  display: block; padding: 4rem 0; text-align: center; opacity: .5;
}`;

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_start',
  async main() {
    if (!(await read()).unhookEnabled) return;
    const style = document.createElement('style');
    style.textContent = css;
    // document_start can beat <head> into existence; documentElement always exists by then.
    document.documentElement.append(style);
  },
});
