<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/daedalus-mark.svg">
  <img src="assets/daedalus-mark.svg" alt="Daedalus" width="112" height="112">
</picture>

# Daedalus

**A local-first utility belt for a calmer browser.**

[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/runtime-Bun-black?logo=bun)](https://bun.sh/)
[![License: MIT](https://img.shields.io/badge/license-MIT-16A34A.svg)](LICENSE)

</div>

Daedalus helps you save browser work, remove stale tabs safely, and inspect what a page is doing—without an account, backend, telemetry, or analytics.

## What it does

| Tool | Purpose |
|---|---|
| **Read later** | Save a window's tabs as a named, tagged list—keeping them open or closing them. Lists show their items: open one, reorder either level, add the current tab, rename and retag in place. |
| **Tab cleaner** | Close tabs left idle past a configurable threshold, optionally filing them into a read-later list first. |
| **Page controls** | Dark mode across all sites with per-domain exceptions, autoplay blocking, and consent rejection where supported. |
| **Inspect** | Trace redirects and view cookies limited to domains open in the current window. |
| **Image search** | Right-click any image to search it with Google Lens, Bing, or Yandex—the image URL is sent, never the bytes. |
| **UA headers** | Apply built-in, session-only user-agent headers to matching tabs in one window. |

Everything but saving lives in the manager: the Chrome side panel, or the same page as a full tab from **Extension options**. Browsers without the side panel API open it as a tab instead.

### How two of them work

**Dark mode** inverts the page with a stylesheet rather than inline styles, so elements added later are covered too. After the page renders it samples the painted background at four points—`html` and `body` are transparent on plenty of sites—and drops the inversion when the page is already dark, instead of turning it light.

**Autoplay blocking** replaces `HTMLMediaElement.prototype.play` from the page's own JS world and dispatches synthetic `play`/`playing`/`pause` events, so a player that would retry believes playback started. Pausing after the fact instead makes feed players fight back in a loop that freezes the tab. It covers iframes, and strips the `autoplay` attribute that declarative `<video autoplay>` uses without ever calling `play()`. Playback within a second of a click or keypress is always yours, so pressing play works.

## Privacy by default

- **Local-first:** read-later groups stay in `chrome.storage.local`.
- **Minimal sync:** only compact preferences and per-site rules use Chrome Sync.
- **Session-scoped:** restore history and UA rules disappear when the browser session ends.
- **No hidden requests:** Daedalus only opens a provider URL when you explicitly choose reverse-image search.
- **No Incognito support:** the extension is explicitly disabled there.

## Install from source

```bash
git clone https://github.com/jvillegasd/daedalus.git
cd daedalus
bun install
bun run build
```

Open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, then choose `.output/chrome-mv3`.

## Development

```bash
bun run dev     # Watch and rebuild
bun test        # Unit tests
bun run build   # Production extension
```

## Safety notes

The cleaner never closes active, pinned, audible, excluded-domain, or detected-unsaved-form tabs, and it skips any tab whose idle age the browser can't report. It is still a destructive action: add important sites to the exclusion list, or turn on saving to a list so closed tabs are kept.

"Restore last closed" is session-scoped and empties when the browser does. Saving to a read-later list is the durable option.

Chrome cookies are profile-wide. Daedalus filters its cookie view to domains open in the selected window, but it does not create isolated cookie jars.

UA profiles change the request header only; they do not emulate a device, browser engine, or viewport.

## License

[MIT](LICENSE)
