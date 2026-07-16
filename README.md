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
| **Read later** | Save selected or window tabs as named, tagged groups and reopen them later. |
| **Tab cleaner** | Close inactive tabs after a configurable delay, with a session restore list. |
| **Page controls** | Enable dark mode, control autoplay, and reject non-essential consent where supported. |
| **Inspect** | Trace redirects and view cookies limited to domains open in the current window. |
| **Image search** | Search an image URL with Google Lens, Bing, or Yandex—never upload image bytes. |
| **UA headers** | Apply built-in, session-only user-agent headers to matching tabs in one window. |

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

The cleaner never closes active, pinned, audible, excluded-domain, or detected-unsaved-form tabs. It is still a destructive action: add important sites to the exclusion list.

Chrome cookies are profile-wide. Daedalus filters its cookie view to domains open in the selected window, but it does not create isolated cookie jars.

UA profiles change the request header only; they do not emulate a device, browser engine, or viewport.

## License

[MIT](LICENSE)
