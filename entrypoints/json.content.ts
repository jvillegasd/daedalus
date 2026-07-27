import { highlight } from '../src/json';
import { activeOn, read } from '../src/preferences';

// One palette written once: light-dark() picks the arm from the root's color-scheme, so
// following the OS is the default and forcing dark is a single property to set below.
const css = `
  :root { color-scheme: light dark }
  body { margin: 0; background: light-dark(#ffffff, #0f1115); color: light-dark(#24292f, #c9d1d9) }
  pre.daedalus-json { margin: 0; padding: 1rem; font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; tab-size: 2; white-space: pre-wrap; word-break: break-word }
  .j-k { color: light-dark(#0550ae, #7ee787) }
  .j-s { color: light-dark(#0a3069, #a5d6ff) }
  .j-n { color: light-dark(#953800, #f0a35e) }
  .j-b { color: light-dark(#8250df, #d2a8ff) }`;

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_end',
  async main() {
    // The cheap check first: a JSON response is the only thing this touches, and every other
    // page on the web pays just this comparison. Chrome renders it as a lone <pre>.
    if (document.contentType !== 'application/json') return;
    const source = document.body?.textContent ?? '';
    let pretty: string;
    // Servers label plenty of things application/json that aren't, and an error page is a
    // worse thing to blank out than a formatted body is to miss.
    try { pretty = JSON.stringify(JSON.parse(source), null, 2); } catch { return; }
    const prefs = await read();
    if (!prefs.jsonFormat) return;

    // Dark mode skips JSON documents rather than inverting this page, so honour it here
    // instead — otherwise turning dark mode on would leave one page light.
    if (activeOn('dark', prefs, location.href)) document.documentElement.style.colorScheme = 'dark';
    const style = document.createElement('style');
    style.textContent = css;
    const pre = document.createElement('pre');
    pre.className = 'daedalus-json';
    pre.innerHTML = highlight(pretty);
    document.body.replaceChildren(style, pre);
  },
});
