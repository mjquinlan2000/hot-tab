# Extension Verification and Automation Playbook

Strategies, automated test patterns, and troubleshooting procedures for testing Manifest V3 browser extensions.

## Chrome Unpacked Loading Realities (M137+)

Starting with Chromium milestone 137 (M137+), Chrome ignores the traditional `--load-extension` command-line switch during standard launches. Modern Chrome builds will launch without the extension installed, regardless of command-line flags.

### Operational Consequences

- **`web-ext run` unreliability**: Because `web-ext run` relies on CLI flags like `--load-extension`, it fails silently on current Chromium releases. The browser launches, but no extension is loaded.
- **Manual verification path**: The primary reliable manual method for current Chrome is navigating to `chrome://extensions`, enabling "Developer mode", clicking "Load unpacked", and selecting the extension build directory.
- **Automated verification options**:
  1. Use an older Chromium binary (e.g., Chromium 133) that still respects the `--load-extension` flag.
  2. Use Puppeteer Core with a browser-level Chrome DevTools Protocol (CDP) connection over pipes (`pipe: true`) and issue the internal CDP command `Extensions.loadUnpacked({ path: absPath })`.

### Isolated Test Profiles

Never execute automated tests or manual validation against your personal Chrome profile. Always create and pass a clean, ephemeral user data directory:

```javascript
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tempUserDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "chrome-test-profile-"));
// Pass `--user-data-dir=${tempUserDataDir}` to Chrome flags
```

Clean up the temporary directory after the test run terminates.

## Service Worker CDP Automation and Debugging

A major source of automation hangs in Puppeteer is extension service worker inspection.

### The `target.worker()` Stall

Calling `await target.worker()` on an extension service worker target frequently hangs indefinitely. Chrome attaches to extension service workers in a paused state awaiting debugger signals. If the runner does not explicitly release the execution lock, the promise never resolves.

### Safe Raw CDP Evaluation Pattern

Connect directly via CDP session, enable runtime domains, explicitly signal execution readiness, and always wrap interactions in strict timeouts and watchdog processes:

```javascript
// Target discovery
const targets = browser.targets(); // synchronous in Puppeteer
const workerTarget = targets.find(
  (t) => t.type() === "service_worker" && t.url().startsWith("chrome-extension://")
);

if (!workerTarget) {
  // Absence of service worker target is often normal if the worker has idled out
  console.log("Service worker target not active (may be idle)");
} else {
  // Create direct CDP session
  const client = await workerTarget.createCDPSession();

  // Enable runtime and release debugger pause
  await client.send("Runtime.enable");
  await client.send("Runtime.runIfWaitingForDebugger");

  // Evaluate with timeout guard
  const evalPromise = client.send("Runtime.evaluate", {
    expression: "chrome.runtime.getManifest().version",
    awaitPromise: true,
    returnByValue: true
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("CDP evaluation timed out")), 5000)
  );

  const result = await Promise.race([evalPromise, timeoutPromise]);
  console.log("Manifest version from worker:", result.result.value);
}
```

## Common Diagnostic Traps

### 1. `ERR_BLOCKED_BY_CLIENT` on Extension URLs

When navigating a standard browser tab to an internal extension URL (e.g., `chrome-extension://<id>/popup.html`), Chromium may block the navigation with `net::ERR_BLOCKED_BY_CLIENT`.
- **Reason**: The resource is not listed in `web_accessible_resources`.
- **Meaning**: This is default browser security enforcement, not a bug in the extension. When loaded in an environment with the extension installed, navigating directly via an extension-aware inspection page works as expected.

### 2. Missing Service Worker in Target Lists

Unlike persistent background pages in Manifest V2, MV3 service workers terminate when idle (typically within 30 seconds of inactivity).
- If your test runner checks `browser.targets()` and cannot locate the `service_worker` target, it usually indicates that the worker has idled out according to design.
- To wake an idle service worker, dispatch an event that targets the extension (such as clicking the action icon, sending a runtime message, or updating a tab).

### 3. Verifying Single-Instance Context Menus

Because `contextMenus.create` must execute inside `chrome.runtime.onInstalled`, you can assert that initialization ran exactly once by attempting to create an item with the same identifier in your test and confirming rejection:

```javascript
// Verification check inside extension context:
chrome.contextMenus.create({ id: "menu-item-id", title: "Test" }, () => {
  if (chrome.runtime.lastError) {
    // Rejection confirms the item was already registered on installation
    console.log("Context menu successfully verified as already registered");
  }
});
```

## Testing Extension Keyboard Commands

There is no native browser API or CDP command to programmatically simulate an extension keyboard command (`chrome.commands.onCommand`).

- **CDP Input limitation**: Dispatching keystrokes via CDP `Input.dispatchKeyEvent` or Puppeteer `page.keyboard.press()` sends events to the active web page DOM, not to the browser's global hotkey listener.
- **Architectural decoupling**: Because hotkeys cannot be fired programmatically by automated browsers, extract all command logic into pure functions separated from browser API calls.
- **Testing pure logic**: Test core arithmetic, array index manipulation, and business state in standalone Node.js test runners using native assertions (`node:assert/strict`).
- **Reporting constraints**: Never claim an automated test verified keyboard command dispatch. Always clarify that command bindings require manual verification in the browser or automated unit tests on the extracted pure logic.

## Popup UI and Screenshot Automation

Extension popups can be rendered and inspected inside automated browser sessions.

### Stubbing Runtime APIs for UI Testing

Use `page.evaluateOnNewDocument` to inject stubs for `chrome.*` APIs before popup scripts execute. This allows verifying UI states that are otherwise difficult to trigger on demand:

```javascript
import puppeteer from "puppeteer-core";

const page = await browser.newPage();

// Stub chrome.commands.getAll to return specific shortcut chords
await page.evaluateOnNewDocument(() => {
  window.chrome = window.chrome || {};
  window.chrome.commands = {
    getAll: async () => [
      { name: "_execute_action", description: "", shortcut: "Alt+Shift+P" },
      { name: "jump-next", description: "Jump to next item", shortcut: "Ctrl+Shift+Right" },
      { name: "jump-prev", description: "Jump to previous item", shortcut: "Ctrl+Shift+Left" }
    ]
  };
});

await page.goto(`chrome-extension://${extensionId}/popup.html`);
```

### Color Scheme Verification

Verify that extension UIs render correctly in both light and dark themes using media feature emulation:

```javascript
// Light theme screenshot
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
await page.screenshot({ path: "screenshots/popup-light.png" });

// Dark theme screenshot
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
await page.screenshot({ path: "screenshots/popup-dark.png" });
```

## Linter and CLI Tool Caveats

### `web-ext lint` Limitations

`web-ext lint` is maintained by Mozilla and primarily targets Firefox extensions:
- It reports false-positive errors on valid Chrome Manifest V3 extensions, such as missing gecko extension IDs or unsupported service worker configurations.
- Do not use `web-ext lint` as an automated gate or pass/fail criterion for Chrome-only extensions.

### Shell Exit Code Masking

When executing verification scripts in shell pipelines, piping output to utilities like `tail` or `head` masks non-zero exit codes unless `set -o pipefail` is active:

```bash
# Problematic: Masked exit code returns 0 even if the test runner failed
node test-runner.mjs | tail -n 20

# Reliable: Captures failure exit code accurately
node test-runner.mjs
```
