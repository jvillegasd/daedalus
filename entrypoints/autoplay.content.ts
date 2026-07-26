// Runs in the page's own JS world, so the prototypes it patches are the ones the site sees.
// Reacting to the `play` event from the isolated world could only pause after the fact, and
// feed players answer a pause by calling play() again — an unbounded loop that freezes the
// tab. Neutralising play() instead means there is nothing for them to react to.
//
// Gating comes from a data attribute the isolated content script sets once it has read the
// prefs, because chrome.storage isn't reachable from here. No attribute means no blocking,
// so anything unexpected leaves playback exactly as the site intended.
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  allFrames: true,
  matchAboutBlank: true,
  world: 'MAIN',
  main() {
    const nativePlay = HTMLMediaElement.prototype.play;
    const lastFake = new WeakMap<HTMLMediaElement, number>();
    let lastGesture = 0;
    for (const type of ['pointerdown', 'keydown', 'touchend']) addEventListener(type, () => { lastGesture = Date.now(); }, true);

    const blocking = () => document.documentElement?.dataset.daedalusAutoplay === 'block' && Date.now() - lastGesture > 1000;

    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      if (!blocking()) return nativePlay.call(this);
      // Tell the player what it expects to hear. Without these it assumes the call failed
      // and retries in a loop, which is the behaviour that pegged the main thread before.
      const now = performance.now();
      if (now - (lastFake.get(this) ?? -Infinity) > 10) {
        lastFake.set(this, now);
        this.dispatchEvent(new Event('play'));
        this.dispatchEvent(new Event('playing'));
        setTimeout(() => { if (this.paused) this.dispatchEvent(new Event('pause')); }, 100);
      }
      return Promise.resolve();
    };

    // Declarative <video autoplay> never calls play(), so strip the attribute as it appears.
    const strip = (node: Node) => {
      if (node instanceof HTMLMediaElement) node.removeAttribute('autoplay');
      else if (node instanceof Element) node.querySelectorAll('video[autoplay],audio[autoplay]').forEach(m => m.removeAttribute('autoplay'));
    };
    new MutationObserver(records => { if (blocking()) for (const r of records) r.addedNodes.forEach(strip); })
      .observe(document, { childList: true, subtree: true });
  },
});
