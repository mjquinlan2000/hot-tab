# Hot Tab

Hot Tab adds the tab-management keyboard shortcuts that Google Chrome is missing.

## Shortcuts

Default keyboard shortcuts for the four available actions:

| Action | Command ID | Default Keybinding |
| --- | --- | --- |
| Move tab left | `move-left` | `Ctrl+Shift+Left` |
| Move tab right | `move-right` | `Ctrl+Shift+Right` |
| Toggle pin on current tab | `pin-tab` | `Ctrl+Shift+Down` |
| Close other tabs | `close-other-tabs` | `Ctrl+Shift+K` |

On macOS, the default bindings use literal Control (the manifest uses the `MacCtrl` token), not Command. Shortcuts can be customized at any time by navigating to `chrome://extensions/shortcuts`.

## Requirements

- Node.js (version pinned in `mise.toml`; install with `mise install`)
- npm

No global packages are required; `web-ext` is installed locally as a development dependency.

## Install

```sh
npm install
```

## Build

```sh
npm run build
```

This compiles `src/*.ts` with `tsc` to `dist/js/` and copies `public/` assets to `dist/`. **`dist/` is the folder you load as an unpacked extension.**

Built layout:

```text
dist/
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── js/
│   ├── background.js
│   ├── background.js.map
│   ├── popup.js
│   ├── popup.js.map
│   ├── tab-order.js
│   └── tab-order.js.map
├── manifest.json
├── popup.css
└── popup.html
```

## Loading in Chrome

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** via the toggle in the top right corner.
3. Click **Load unpacked**.
4. Select the `dist/` directory from this repository.

Recent Chrome releases (M137+) ignore the `--load-extension` command-line switch, so manual loading through the Extensions page is the reliable path.

## Development

- `npm run watch`: Runs `tsc` in watch mode and re-copies public assets on change.
- `npm run typecheck`: Runs `tsc --noEmit` to verify types without emitting.
- `npm run smoke`: Runs the build followed by the pure tab-order smoke check in `scripts/smoke-tab-order.mjs`.
- `npm run clean`: Cleans build artifacts (`dist/` and `web-ext-artifacts/`).

## Packaging

```sh
npm run package
```

Runs the build and packages the extension into a zip archive inside `web-ext-artifacts/` via `web-ext`.

## Architecture

The extension has zero runtime dependencies and uses Chrome's native Manifest V3 APIs.

- `src/background.ts`: Manifest V3 service worker that listens for keyboard command events and context menu clicks. It registers the context menu in `runtime.onInstalled` because MV3 service workers terminate and restart on demand, and attempting to re-create an existing menu ID throws an error.
- `src/tab-order.ts`: Pure wrap-arithmetic module that computes destination tab indices respecting pinned and unpinned tab bands.
- `src/popup.ts`: Script that drives the popup, displaying configured shortcuts and linking to `chrome://extensions/shortcuts`.
- `public/`: Static extension assets, including `manifest.json`, popup markup and styles (`popup.html`, `popup.css`), and icons.

Emitted ES modules load natively in Chrome, which is why relative imports across source files in `src/` carry an explicit `.js` extension (e.g. `import { nextTabIndex } from "./tab-order.js"`).

## Operating Systems

Developed on macOS and targets Chrome.

## License

MIT
