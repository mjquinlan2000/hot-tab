# Manifest V3 Architecture and Reference

Technical reference for building, configuring, and migrating browser extensions on Manifest V3 (MV3).

## Service Worker Lifecycle and Event Registration

Manifest V3 replaces background pages with event-driven service workers. Service workers start when an event fires and terminate after remaining idle for a brief period (typically 30 seconds).

### Event Listener Registration Rules

1. **Synchronous top-level registration**: All listeners for browser events must be added synchronously in the initial turn of the service worker script. If a listener is added inside an asynchronous callback or after an `await`, the browser cannot dispatch waking events to that listener.

```typescript
// Correct: Synchronous top-level registration
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    setupInitialState();
  }
});

chrome.commands.onCommand.addListener((command) => {
  handleCommand(command);
});

chrome.action.onClicked.addListener((tab) => {
  handleActionClick(tab);
});

// Incorrect: Asynchronous listener registration (events will be dropped)
initExtension().then(() => {
  chrome.commands.onCommand.addListener(handleCommand);
});
```

2. **One-time initialization vs. runtime events**:
   - `chrome.runtime.onInstalled`: Runs on initial installation, extension updates, or browser updates. Use this hook for one-time initialization, such as creating context menus or populating initial storage defaults.
   - Calling `chrome.contextMenus.create()` at top level will fail with `Cannot create item with duplicate id` whenever the service worker wakes up from an idle termination.

```typescript
// Correct: Register context menus inside onInstalled
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "action-inspect",
    title: "Inspect Target",
    contexts: ["selection", "link"]
  });
});

// Context menu click handling stays at top level
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "action-inspect") {
    processSelection(info.selectionText);
  }
});
```

3. **No persistent global memory**:
   - Global variables in a service worker are destroyed when the worker idles out.
   - Do not maintain state caches or session counters in global variables unless backed by persistent storage.

## Storage Tiers

Manifest V3 provides three primary storage areas under `chrome.storage`:

| Storage Area | Persistence | Quota | Purpose |
|--------------|-------------|-------|---------|
| `chrome.storage.local` | Survives restarts and browser reboots | 10 MB (extendable via `unlimitedStorage`) | Local configuration, user preferences, cached datasets |
| `chrome.storage.session` | Cleared when the browser session terminates | 10 MB | Ephemeral worker state, auth tokens, transient UI state |
| `chrome.storage.sync` | Synced across logged-in user devices | 100 KB total (8 KB per item) | Small cross-device user settings |

### Session Storage Access from Content Scripts

By default, `chrome.storage.session` is restricted to trusted extension contexts (service worker, popup, options). To permit content script access:

```typescript
// Inside service worker onInstalled:
chrome.storage.session.setAccessLevel({
  accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS"
});
```

## Messaging Between Contexts

Communication between extension components uses message passing:

### One-Time Requests

1. **Popup or Content Script to Service Worker**:
   ```typescript
   // In popup.ts or content-script.ts
   const response = await chrome.runtime.sendMessage({ type: "FETCH_STATE" });
   ```

2. **Service Worker to Content Script**:
   ```typescript
   // In background.ts
   const response = await chrome.tabs.sendMessage(tabId, { type: "PAGE_ACTION" });
   ```

3. **Handling messages in the receiver**:
   ```typescript
   // In background.ts or content-script.ts
   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
     if (message.type === "FETCH_STATE") {
       readState().then((state) => sendResponse({ success: true, data: state }));
       // Return true to indicate asynchronous sendResponse execution
       return true;
     }
   });
   ```

## Web Accessible Resources and Extension URLs

By default, pages packaged within an extension (such as `popup.html` or internal assets) cannot be embedded or navigated to by ordinary web pages.

- Attempting to load an extension page in an ordinary web tab or iframe without proper declaration results in `net::ERR_BLOCKED_BY_CLIENT`.
- To expose extension assets to web pages or content scripts, declare them under `web_accessible_resources` in `manifest.json`:

```json
{
  "web_accessible_resources": [
    {
      "resources": ["assets/*.png", "injected.js"],
      "matches": ["https://example.com/*"]
    }
  ]
]
```

Note: Extension action popups defined via `"action": { "default_popup": "popup.html" }` do not need to be web-accessible to function normally through the browser toolbar.

## Manifest Configuration Essentials

A minimal, robust Manifest V3 structure:

```json
{
  "manifest_version": 3,
  "name": "Extension Core",
  "version": "1.0.0",
  "description": "Clean Manifest V3 implementation",
  "minimum_chrome_version": "116",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png"
    }
  },
  "background": {
    "service_worker": "js/background.js",
    "type": "module"
  },
  "permissions": [
    "storage"
  ],
  "commands": {
    "toggle-feature": {
      "suggested_key": {
        "default": "Ctrl+Shift+U",
        "mac": "MacCtrl+Shift+U"
      },
      "description": "Toggle application feature"
    }
  }
}
```

### Manifest Key Notes

- **`type: "module"`**: Setting `"type": "module"` on `background.service_worker` enables native ES module imports in the background script.
- **Icon sizes**: Standard icons must be supplied at 16x16 (favicon/toolbar), 48x48 (extensions management page), and 128x128 (installation/Web Store).
- **`minimum_chrome_version`**: Pinning a minimum version prevents installation on older runtimes lacking key MV3 features (e.g., Chrome 116 introduced `chrome.storage.session` access levels and improved service worker lifecycles).

## Permission Minimization

Request only the minimum permissions necessary for extension operation. Excessive permissions increase user suspicion and store review scrutiny.

### `tabs` vs. `activeTab` vs. No Permissions

- **No permission needed**:
  - Querying tabs for `id`, `index`, `windowId`, `pinned`, `status`, or `active` state.
  - Moving tabs (`chrome.tabs.move`).
  - Switching active tabs (`chrome.tabs.update(tabId, { active: true })`).
  - Creating or closing tabs (`chrome.tabs.create`, `chrome.tabs.remove`).
- **`activeTab` permission**:
  - Grants temporary access to the currently active tab when the user invokes the extension (clicks the toolbar action, activates a context menu item, or triggers a keyboard shortcut).
  - Allows injecting scripts or reading `url` and `title` without requesting broad host permissions or the full `tabs` permission.
- **`tabs` permission**:
  - Required only when your extension needs to access sensitive properties (`url`, `title`, `favIconUrl`) across all tabs in the background without explicit user invocation.

## Common Traps and Migration Pitfalls

### 1. `chrome.tabs.query` Window Scoping

When querying for the "current tab", omitting `currentWindow: true` can return an active tab from an unfocused window:

```typescript
// Incorrect: May select an active tab from an unintended background window
const [tab] = await chrome.tabs.query({ active: true });

// Correct: Guarantees selection of the active tab in the focused user window
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
```

### 2. Native ES Modules and TypeScript Compilations

When compiling TypeScript directly to JavaScript for native ES module loading in Chromium (`"type": "module"` in manifest):

- Modern browsers do not perform module resolution looking for `.ts` files or directories.
- Every relative import in your TypeScript source code must explicitly include the `.js` extension:

```typescript
// Correct: Resolves cleanly in the browser runtime
import { calculateOffset } from "./utils.js";

// Incorrect: Fails in browser runtime with module resolution error
import { calculateOffset } from "./utils";
```

Ensure `moduleResolution` in `tsconfig.json` is set to `"bundler"` or `"node16"`/`"nodenext"` so the TypeScript compiler recognizes these explicit `.js` import paths.

### 3. Service Worker Execution Environment

Service workers execute in a worker context:
- No `window` or `document` objects are defined.
- DOM parsing cannot use `DOMParser` or `document.createElement()`. Use standard string parsing, `OffscreenCanvas`, or regex.
- `XMLHttpRequest` is not supported; use `fetch()`.
- Timers like `setTimeout` and `setInterval` are unreliable across idle periods. Use `chrome.alarms` for scheduled or periodic background tasks.

### 4. Native Promises vs. `webextension-polyfill`

Chromium extensions do not need `webextension-polyfill`:
- All modern `chrome.*` APIs return native promises when no callback parameter is passed.
- Using native promises eliminates external runtime dependencies and simplifies packaging.
- Callback-style invocation remains supported for backwards compatibility, but promises should be preferred for clarity and error handling.
