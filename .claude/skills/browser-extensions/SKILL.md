---
name: browser-extensions
description: Build and review browser extensions using Manifest V3, Chrome service workers, chrome.* APIs, popups and options pages, keyboard commands, content scripts, packaging, and loading/debugging unpacked extensions. Biases towards retrieval from official docs over pre-trained knowledge, since extension APIs and browser policy shift.
---

# Browser Extensions (Manifest V3)

Guidelines for developing, reviewing, and automating browser extensions using Manifest V3 and native browser APIs.

## Retrieval Sources

Extension capabilities, Chrome policies, and manifest specifications change frequently. Fetch the relevant documentation page rather than relying on pre-trained knowledge, especially as browser vendors deprecate or alter platform APIs.

| Resource | URL | Use For |
|----------|-----|---------|
| Chrome Extensions Documentation | https://developer.chrome.com/docs/extensions | Guides, platform overview, architecture |
| MV3 Migration Guide | https://developer.chrome.com/docs/extensions/develop/migrate | Transitioning background pages, CSP, worker patterns |
| API Reference Index | https://developer.chrome.com/docs/extensions/reference/api | Method signatures, parameters, events, permissions |
| Manifest File Reference | https://developer.chrome.com/docs/extensions/reference/manifest | Manifest keys, action, permissions, commands |
| Chrome Web Store Publishing | https://developer.chrome.com/docs/webstore/publish | Store policies, review requirements, packaging |
| MDN WebExtensions Documentation | https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions | Cross-browser compatibility, Firefox differences |

Fetch the relevant page when implementing or debugging extension functionality.

## When to Use

- Designing or building new browser extensions on Manifest V3
- Implementing or debugging background service workers, lifecycle hooks, or event listeners
- Creating user interfaces: action popups, options pages, side panels, or content scripts
- Configuring keyboard shortcuts via the `commands` manifest key and runtime API
- Managing state using `chrome.storage.local`, `chrome.storage.session`, or `chrome.storage.sync`
- Reviewing extension manifests, CSP rules, and permission boundaries
- Debugging unpacked extensions, service worker lifecycles, and CDP automation flows
- Packaging extensions and verifying build artifacts for submission

## Reference Documentation

- `./references/mv3.md` - Manifest structure, service worker lifecycle, storage tiers, messaging, permissions, and ESM rules
- `./references/verification.md` - Automation strategies, CDP worker debugging, Chrome M137+ load constraints, UI screenshotting, and pure-logic isolation

Search: `onInstalled`, `service_worker`, `MacCtrl`, `web_accessible_resources`, `Extensions.loadUnpacked`

## Core Principles

- **Prefer the smallest toolchain that works**: Modern browser extensions do not require a bundler when there are no npm runtime dependencies. The TypeScript compiler (`tsc`) can emit native ES modules that modern Chromium loads directly. Emitting native ESM requires relative imports in source files to include the explicit `.js` extension (e.g., `import { helper } from "./helper.js"`). Introduce a bundler or meta-framework (such as WXT or Plasmo) only when external npm dependencies, JSX, or complex cross-browser transforms justify the added toolchain complexity.
- **Treat the build output directory as the self-contained extension root**: Output directories should contain all necessary assets: the manifest, compiled scripts, HTML templates, CSS stylesheets, and icon sets. Never hand-modify generated files in the build output.
- **Request the narrowest permission set**: Many operations in `chrome.tabs` (such as querying active tabs, navigation, or tab manipulation) do not require the broad `tabs` permission. Broad permissions trigger additional store review friction and alarming security prompts for users.
- **Prefer native `chrome.*` promise APIs**: In modern Chromium environments, `chrome.*` methods return native promises when callbacks are omitted. Introducing `webextension-polyfill` adds unnecessary abstraction and bundle size for Chrome-first extensions.

## Service Worker Lifecycle

Manifest V3 replaces persistent background pages with ephemeral service workers.

- **Workers terminate on idle**: The background service worker starts in response to an event, processes it, and terminates when idle. Module-level variables are lost between wakeups.
- **Synchronous top-level listener registration**: Every event listener (`chrome.runtime.onInstalled`, `chrome.commands.onCommand`, `chrome.contextMenus.onClicked`) must be registered synchronously during top-level script evaluation. Registering listeners asynchronously or inside promises prevents the browser from waking the worker when those events fire.
- **One-time setup belongs in `onInstalled`**: Initialization logic such as `chrome.contextMenus.create` must execute inside the `chrome.runtime.onInstalled` listener. Calling `contextMenus.create` at module top level throws a duplicate item error whenever the worker wakes from an idle state.
- **Persist state in storage**: Use `chrome.storage.local` for durable data or `chrome.storage.session` for data that should survive worker restarts but clear when the browser closes.
- **Idle worker status is normal**: In `chrome://extensions`, an extension service worker displaying an inactive or idle status is behaving as designed, not crashing.

## Keyboard Commands

The `chrome.commands` API allows user shortcuts, but exhibits platform-specific behavior:

- **MacCtrl vs Ctrl on macOS**: In the `commands` manifest definition, specifying `"Ctrl"` on macOS automatically maps to the Command key (`Command`/`Cmd`). To bind the literal physical Control key on macOS, specify `"MacCtrl"` (e.g., `"mac": "MacCtrl+Shift+Left"`). Binding `"Ctrl"` on macOS risks overriding standard OS navigation and text-selection shortcuts.
- **Key combination budget**: Chromium permits a maximum of 4 `suggested_key` command bindings per extension. Additional commands must be assigned manually by the user via `chrome://extensions/shortcuts`.
- **Filtering `_execute_action`**: The list returned by `chrome.commands.getAll()` includes the default extension action (`_execute_action`). This entry typically has an empty description. Extension popup UIs rendering shortcut tables must filter out commands with empty descriptions.
- **Platform string formats**: Shortcut representations vary by operating system. macOS returns packed glyph clusters with no delimiters (e.g. `⇧⌘K`), whereas Windows and Linux return `+`-separated strings (e.g. `Ctrl+Shift+K`). UI formatters must handle both representations: split on `+` first, then split any remaining run of the modifier glyphs `⌃⌥⇧⌘` into individual keys.

## Extension UI

Extension user interfaces (action popups, options pages, side panels) execute within a restricted web environment:

- **Strict Content Security Policy**: Manifest V3 prohibits inline scripts and inline event attributes (such as `<button onclick="...">`). All logic must reside in external `.js` files loaded via `<script src="...">`.
- **Safe DOM manipulation**: Avoid `innerHTML` when rendering dynamic data to prevent script injection risks. Construct DOM nodes using `document.createElement()` and populate content with `textContent`.
- **Accessible controls**: Use native interactive elements like `<button>` instead of non-semantic containers like `<div>` with click listeners. Non-semantic elements break keyboard navigation and focus rings.
- **Dark mode support**: Popups reflect the browser and operating system appearance. Style extension UIs using the `@media (prefers-color-scheme: dark)` media query to provide appropriate high-contrast palettes.

## Anti-Patterns

- **Wrong**: Calling `chrome.contextMenus.create()` at service worker top level.
  **Right**: Register context menus inside `chrome.runtime.onInstalled.addListener()`.
- **Wrong**: Registering event listeners inside asynchronous initialization promises.
  **Right**: Attach event listeners synchronously in the service worker top-level execution scope.
- **Wrong**: Storing session or runtime state in global JavaScript variables in the background worker.
  **Right**: Read and write state using `chrome.storage.session` or `chrome.storage.local`.
- **Wrong**: Setting `"mac": "Ctrl+..."` in `manifest.json` when targeting the Control key.
  **Right**: Set `"mac": "MacCtrl+..."` to avoid mapping to Command and shadowing system shortcuts.
- **Wrong**: Generating UI structures via string concatenation into `element.innerHTML`.
  **Right**: Use `document.createElement()`, `element.textContent`, and DOM APIs.
- **Wrong**: Calling `chrome.tabs.query({ active: true })` assuming it scopes to the current window.
  **Right**: Always supply `currentWindow: true`: `chrome.tabs.query({ active: true, currentWindow: true })`.
