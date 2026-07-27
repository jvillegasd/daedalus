/** What one frame did when asked to float its video. */
export type PipResult = 'entered' | 'exited' | 'no-video' | { error: string };

/**
 * Injected into the page with `chrome.scripting.executeScript`, which stringifies it — so it
 * must reference nothing outside itself, imports included. Injection is also the reason it
 * works at all: `requestPictureInPicture` needs a user gesture, and a script the browser
 * injects in response to a command or menu click carries one. A message to a content script
 * does not, which is why this isn't in content.ts.
 */
const enterPip = (): PipResult | Promise<PipResult> => {
  if (document.pictureInPictureElement) { document.exitPictureInPicture(); return 'exited'; }
  const videos = [...document.querySelectorAll('video')];
  if (!videos.length) return 'no-video';
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
  return best.requestPictureInPicture().then(
    () => 'entered' as const,
    (e: DOMException) => ({ error: `${e.name}: ${e.message}` }),
  );
};

/**
 * One answer out of every frame's. A page is usually one frame with a video and several
 * without, so "no video here" is the least interesting thing any of them can say: something
 * that floated beats something that failed, and a failure beats an empty frame. Only when
 * every frame came back empty is there really no video on the page.
 */
export const reducePip = (frames: (PipResult | undefined)[]): PipResult =>
  frames.find(f => f === 'entered')
  ?? frames.find(f => f === 'exited')
  ?? frames.find((f): f is { error: string } => !!f && typeof f === 'object')
  ?? 'no-video';

/** The same sentence wherever a surface has room to print one. */
export const pipMessage = (result: PipResult) =>
  typeof result === 'object' ? result.error
    : result === 'entered' ? 'Floating the largest video on this tab.'
    : result === 'exited' ? 'Closed the floating window.'
    : 'No video on this page.';

/** True when the viewer got nothing, which is the only case worth interrupting them about. */
export const pipFailed = (result: PipResult) => result !== 'entered' && result !== 'exited';

/**
 * Float this tab's largest video, or close the floating window if one is already open.
 *
 * `allFrames` because the video is as likely to be in an embed as in the top document — the
 * frames without one answer 'no-video' and are reduced away. The injection happens here
 * rather than behind a message hop so the caller's user gesture is still unspent.
 */
export const requestPip = async (tabId: number): Promise<PipResult> => {
  try {
    const frames = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: enterPip, world: 'MAIN' });
    return reducePip(frames.map(f => f.result as PipResult | undefined));
  } catch (e) {
    // An injection that never ran at all: a chrome:// page, the web store, a tab that closed.
    return { error: e instanceof Error ? e.message : String(e) };
  }
};
