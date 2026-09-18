# CLAUDE.md

Chrome-only Manifest V3 extension providing missing keyboard shortcuts for tab management.
Compiles TypeScript directly to native ES modules via `tsc` with zero runtime dependencies and no bundler.

## Commands

`dist/` is the gitignored loadable unpacked extension root.

| Command | Script in package.json | Purpose |
| --- | --- | --- |
| `npm run build` | `node scripts/build.mjs` | Cleans `dist/`, copies `public/`, and compiles TypeScript to `dist/js/` |
| `npm run watch` | `node scripts/build.mjs --watch` | Watches `public/` assets and runs `tsc --watch` |
| `npm run typecheck` | `tsc --noEmit` | Validates TypeScript types across `src/` without emitting code |
| `npm run smoke` | `node scripts/build.mjs && node scripts/smoke-tab-order.mjs` | Builds and runs assertion smoke tests on compiled `dist/js/tab-order.js` |
| `npm run clean` | `rm -rf dist web-ext-artifacts` | Removes build directories and packaged zip output |
| `npm run package` | `rm -rf web-ext-artifacts && node scripts/build.mjs && web-ext build --source-dir dist --overwrite-dest --ignore-files "js/*.map"` | Builds and packages zip archive into `web-ext-artifacts/` |

Use npm; never run `yarn install` (it creates a competing lockfile). Scripts avoid nested `npm run` calls to prevent `npm_config_*` warnings under yarn environments.

## Repository Layout

```text
public/                     Static extension assets copied verbatim to dist/
├── manifest.json           MV3 manifest (permissions, commands, icons, action)
├── popup.html              Popup markup with template elements
├── popup.css               Popup styles (supports light/dark schemes)
└── icons/                  Extension icons (16px, 48px, 128px PNGs)
src/                        TypeScript source compiled by tsc to dist/js/
├── background.ts           MV3 service worker: command events & context menu
├── popup.ts                Popup script: fetches commands & renders shortcut list
└── tab-order.ts            Pure wrap arithmetic for pinned and unpinned tab bands
scripts/                    Tooling and verification scripts
├── build.mjs               Build runner: clears dist/, copies public/, runs tsc
└── smoke-tab-order.mjs     Zero-dependency Node assertion test for tab-order logic
```

## Hard Rules

- **Relative imports require `.js` extensions**: `src/` compiles directly to ES modules loaded natively by Chrome. Imports like `import { nextTabIndex } from "./tab-order.js"` must use `.js` despite `.ts` source files.
- **Zero runtime dependencies and no bundlers**: Never introduce webpack, vite, esbuild, or runtime packages.
- **Register context menus inside `runtime.onInstalled`**: Top-level `contextMenus.create` throws `Cannot create item with duplicate id <id>` on service worker restart. Keep event listeners (`commands.onCommand`, `contextMenus.onClicked`) registered synchronously at top level so event wakeups are caught.
- **Scope queries to `currentWindow`**: Always pass `currentWindow: true` in `chrome.tabs.query` (e.g. `{ currentWindow: true }`) or queries match tabs in other windows.
- **No `innerHTML` in popup code**: MV3 CSP blocks unsafe HTML injection. Construct DOM elements explicitly (`document.createElement`, `textContent`).
- **Isolate command logic in pure modules**: Extension keyboard commands cannot be dispatched programmatically; keep tab arithmetic and manipulation logic in pure modules (like `tab-order.ts`) so they remain verifiable in Node.
- **Manifest shortcut syntax**: On macOS, `Ctrl` represents Command (`⌘`). Use `MacCtrl` for literal Control (`⌃`). Chrome permits at most 4 `suggested_key` commands per extension.
- **Asset separation**: Static files belong in `public/` and compiled scripts in `dist/js/`. Never edit `dist/` directly.

## Verifying Changes

Proof of correctness relies on:
- `npm run typecheck`: Confirm no type or strict compiler errors.
- `npm run smoke`: Verify tab order wrap arithmetic passes assertions against compiled `dist/js/tab-order.js`.
- **Manual load via `chrome://extensions`**: Enable Developer mode, click **Load unpacked**, and select `dist/`. Chrome M137+ ignores `--load-extension` flags, so manual loading is the required path.
- **Manual hotkey testing**: Keyboard command delivery cannot be automated via CDP (Input events route to DOM, not browser commands); test shortcuts manually.

Do not use `web-ext lint` as a gate: it is Firefox-oriented and reports false failures for Chrome-only MV3 service workers.

## Gotchas

- **Service worker idle timeout**: MV3 service workers terminate after inactivity. An inactive status on `chrome://extensions` is normal behavior, not an error.
- **Extension reload**: After modifying code and rebuilding, click the reload button on the extension card in `chrome://extensions`.
- **Command filtering**: `chrome.commands.getAll()` returns `_execute_action` with an empty description. Always filter commands by non-empty description before display.
- **Platform shortcut formats**: macOS returns shortcut key combinations as packed glyph strings (e.g. `⇧⌘K`), whereas Windows and Linux return `+`-delimited strings (e.g. `Ctrl+Shift+K`). UI parsing must handle both formats.
