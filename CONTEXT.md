# Domain language

The words this codebase uses, and where each one lives. The README says what the tools do;
this says what to call things and which name is the real one when two disagree.

## The saved lists

**Saved list** — a named, tagged set of saved tabs. `TabGroup` in the code, "list" in the UI,
"Read later" in the README as the name of the feature that creates them. `TabGroup` is the
older name and the type is used widely enough that renaming it is not worth the churn; prefer
"saved list" in prose and comments.

**Saved tab** — `SavedTab`: url, title, favicon, pinned. Not a `chrome.tabs.Tab` — it is what
survives the tab being closed. `tabData` (`src/cleaner.ts`) is the one conversion between them.

**List action** — a described change to the saved lists: rename, tag-add, tag-remove, append,
tab-remove, tab-move, group-move, group-remove. `ListAction` in `src/lists.ts`. A surface
builds one from a click and hands it to `apply`; it never performs the change itself.

**Apply** — `apply(all, action)` in `src/lists.ts`, the one interface the saved lists change
through. Pure, and it returns the array it was given when the action changed nothing.

## The surfaces

**Surface** — anything with a UI that talks to the worker: the manager, the popup, and the
content scripts. Used in preference to "page" or "view", both of which mean something narrower
inside the manager.

**Manager** — the side panel (`entrypoints/sidepanel/`), one page per feature. Runs as an
ordinary tab in browsers without the sidePanel API, which is why anything resolving "the tab I
am acting on" has to skip our own pages.

**Popup** — `entrypoints/popup/`, the toolbar surface: saving the current window, the four
per-site switches, and a read-mostly view of the saved lists.

**Target tab** — the page tab a surface is acting on, which is not always the active tab: the
manager can itself be the active tab in a browser without the sidePanel API. `targetTab` in
`src/surface.ts`, and the reason a surface never calls `chrome.tabs.query` for this directly.

**Protocol** — the typed set of conversations between a surface and the worker,
`src/protocol.ts`. A kind's request and reply are declared together; `send` throws on a
worker-side failure so callers use try/catch.

## Per-site rules

**Scoped feature** — dark mode, autoplay blocking, GDPR rejection: a global switch plus two
domain lists, one that turns the feature on for a site while the global is off and one that
turns it off while the global is on. `Scoped` in `src/preferences.ts`.

**Active on** — whether a scoped feature actually runs on a URL. `activeOn`. The only thing a
per-site button's state is allowed to mean.

**Live field** — the domain list a click writes to, given what the global switch is doing.
`liveField`. Writing to the other one writes to something nothing reads.

**Exclusion list** — `excludedDomains`, the cleaner's. A domain here is never closed. Distinct
from a scoped feature's exclude list, which only turns that feature off.

## The cleaner

**Stale tab** — a tab idle past the threshold and eligible: not active, pinned, audible,
discarded, excluded, or a `chrome:` page. Idle age comes from the browser's `lastAccessed`,
never from our own bookkeeping — the worker is evicted while idle.

**Clean plan** — `CleanPlan`, everything the cleaner decided, as data: what to close, what to
add to the restore history, and the lists to write first. `planClean` decides, `applyClean`
writes. The applier holds no policy of its own.

**Restore history** — every tab the cleaner closed this session, session-scoped and gone when
the browser closes. Saving to a list is the durable option.

**Unsaved tab** — a tab with typed-in, unsubmitted form input. Kept in session storage rather
than memory, because losing it would let the cleaner close a tab someone was writing in.
