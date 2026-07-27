/**
 * Injected into the page with `chrome.scripting.executeScript`, which stringifies it — so it
 * must reference nothing outside itself, imports included. Injection is also the reason it
 * works at all: `requestPictureInPicture` needs a user gesture, and a script the browser
 * injects in response to a command or menu click carries one. A message to a content script
 * does not, which is why this isn't in content.ts.
 *
 * Returns a reason string so the caller can say why nothing floated instead of guessing.
 */
export const enterPip = () => {
  if (document.pictureInPictureElement) { document.exitPictureInPicture(); return 'closed'; }
  const videos = [...document.querySelectorAll('video')];
  if (!videos.length) return 'no video in this frame';
  // ponytail: no readyState filter — sites like x.com leave it at 0 until playback starts, and
  // filtering on it dropped the only video on the page. Let the browser reject instead; its
  // error names the actual problem.
  // Largest by intrinsic size, not layout size: an offscreen or CSS-collapsed video reports
  // clientWidth 0 and could never win. A video that is actually playing beats a bigger idle one.
  const area = (v: HTMLVideoElement) => v.videoWidth * v.videoHeight;
  const live = videos.filter(v => !v.paused && !v.ended);
  const best = (live.length ? live : videos).sort((a, b) => area(b) - area(a))[0];
  // `disablepictureinpicture` is the site opting its viewers out, and clearing the property
  // removes the attribute — which is the entire point of a button the viewer pressed.
  best.disablePictureInPicture = false;
  return best.requestPictureInPicture().then(() => 'ok', (e: DOMException) => `${e.name}: ${e.message}`);
};
