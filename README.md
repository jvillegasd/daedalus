# Daedalus

**A local-first utility belt for Chrome.** Save tab groups, tame inactive tabs, inspect redirects and cookies, and apply lightweight per-site controls—without accounts, servers, analytics, or background data collection.

<p align="center"><img src="assets/daedalus-mark.svg" width="128" alt="Daedalus logo"></p>

## Highlights

- **Read later:** save selected or window tabs into named, tagged local groups and reopen them when needed.
- **Tab cleaner:** closes inactive tabs after a configurable delay, while protecting active, pinned, audible, excluded-domain, and unsaved-form tabs. Recently closed tabs can be restored during the browser session.
- **Page controls:** opt into CSS-filter dark mode, autoplay allowlisting, and best-effort rejection of non-essential consent dialogs per site.
- **Inspection:** trace main-document redirects, view cookies scoped to domains currently open in the selected window, and import/export cookie JSON with confirmation.
- **Image search:** right-click an image to open its URL in Google Lens, Bing, or Yandex—Daedalus never uploads image bytes.
- **UA headers:** apply built-in, session-only, current-window request-header profiles. This is header-only; it is not device emulation.

## Privacy

Daedalus is local-first by design:

- No account, backend, telemetry, analytics, or remote sync service.
- Read-later groups are stored locally; small preferences use Chrome Sync.
- Session-only data includes tab restore history and user-agent rules.
- Network requests happen only when you explicitly use a reverse-image search provider.
- Incognito mode is not supported.

## Install locally

```bash
bun install
bun run build
```

In Chrome or Chromium, visit `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `.output/chrome-mv3`.

## Development

```bash
bun run dev
bun test
bun run build
```

## Scope and caveats

Cookie storage belongs to your Chrome profile. Daedalus narrows the cookie list to domains open in the current window; it does not isolate cookies by window. Automatic tab cleanup is deliberately conservative, but closing tabs is still destructive—use excluded domains for work that should never be cleaned.

## License

[MIT](LICENSE)
