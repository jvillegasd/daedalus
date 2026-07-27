/**
 * Injected into the page with `chrome.scripting.executeScript`, which stringifies it — so it
 * must reference nothing outside itself, imports included. Injection is also the reason it
 * works at all: `requestPictureInPicture` needs a user gesture, and a script the browser
 * injects in response to a command or menu click carries one. A message to a content script
 * does not, which is why this isn't in content.ts.
 */
export const enterPip = () => {
  if (document.pictureInPictureElement) { document.exitPictureInPicture(); return; }
  const best = [...document.querySelectorAll('video')]
    .filter(v => v.readyState > 0 && !v.disablePictureInPicture)
    .sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
  best?.requestPictureInPicture().catch(() => {});
};
