// Runs in the page's own JS world, so the prototypes it patches are the ones the site sees.
// Reacting to the `play` event from the isolated world could only pause after the fact, and
// feed players answer a pause by calling play() again — an unbounded loop that freezes the
// tab. Neutralising play() instead means there is nothing for them to react to.
//
// Gating comes from a data attribute the isolated content script sets once it has read the
// prefs, because chrome.storage isn't reachable from here. No attribute means no blocking,
// so anything unexpected leaves playback exactly as the site intended.
// ponytail: top frame only. The verdict attribute is set by content.ts, which does not run
// in subframes, so a copy of this script in an iframe could never block anything — it just
// paid for listeners. Blocking autoplay inside embeds means giving content.ts allFrames and
// a prefs read per frame; do that if embedded players turn out to matter.
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    const nativePlay = HTMLMediaElement.prototype.play;
    const lastFake = new WeakMap<HTMLMediaElement, number>();
    let lastGesture = 0;
    for (const type of ['pointerdown', 'keydown', 'touchend']) addEventListener(type, () => { lastGesture = Date.now(); }, { capture: true, passive: true });

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

    // Declarative <video autoplay> never calls play(), so catch it from its own play event.
    // The retry loop that rules this out for scripted playback does not apply here: nothing
    // in the page asked for this one, so there is no caller to answer with a fake success.
    // Watching the event beats a subtree MutationObserver, which charged every DOM insertion
    // on the page a querySelectorAll to find media that almost never arrived.
    addEventListener('play', e => {
      const media = e.target as HTMLMediaElement;
      if (!blocking() || !media.hasAttribute?.('autoplay')) return;
      media.removeAttribute('autoplay');
      if (!media.paused) media.pause();
    }, true);
  },
});
