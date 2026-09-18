import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const distPopup = path.join(repoRoot, "dist", "popup.html");
const defaultChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
};

const WINDOWS_SHORTCUTS = [
  { name: "_execute_action", description: "", shortcut: "Alt+Shift+H" },
  { name: "move-left", description: "Move tab left", shortcut: "Ctrl+Shift+Left" },
  { name: "move-right", description: "Move tab right", shortcut: "Ctrl+Shift+Right" },
  { name: "pin-tab", description: "Toggle pin on current tab", shortcut: "Ctrl+Shift+Down" },
  { name: "close-other-tabs", description: "Close other tabs", shortcut: "Ctrl+Shift+K" },
];

const MAC_SHORTCUTS = [
  { name: "_execute_action", description: "", shortcut: "⌥⇧H" },
  { name: "move-left", description: "Move tab left", shortcut: "⌃⇧←" },
  { name: "move-right", description: "Move tab right", shortcut: "⌃⇧→" },
  { name: "pin-tab", description: "Toggle pin on current tab", shortcut: "⌃⇧↓" },
  { name: "close-other-tabs", description: "Close other tabs", shortcut: "⌃⇧K" },
];

const SHORTCUT_SETS = { win: WINDOWS_SHORTCUTS, mac: MAC_SHORTCUTS };

const SHOTS = [
  {
    output: "store/screenshots/01-popup-light.png",
    template: "/store/templates/screenshot.html",
    query: { variant: "win", caption: "Every shortcut, one click away" },
    colorScheme: "light",
    width: 1280,
    height: 800,
    awaitPopup: true,
  },
  {
    output: "store/screenshots/02-popup-dark.png",
    template: "/store/templates/screenshot.html",
    query: { variant: "win", caption: "Matches your dark mode" },
    colorScheme: "dark",
    width: 1280,
    height: 800,
    awaitPopup: true,
  },
  {
    output: "store/screenshots/03-popup-macos.png",
    template: "/store/templates/screenshot.html",
    query: { variant: "mac", caption: "Native ⌃⇧ glyphs on macOS" },
    colorScheme: "light",
    width: 1280,
    height: 800,
    awaitPopup: true,
  },
  {
    output: "store/promo/small-tile-440x280.png",
    template: "/store/templates/promo-tile.html",
    query: {},
    colorScheme: "light",
    width: 440,
    height: 280,
    awaitPopup: false,
  },
];

const installChromeStub = (sets) => {
  const variant = new URLSearchParams(location.search).get("variant") ?? "win";
  const commands = sets[variant] ?? sets.win;
  globalThis.chrome = {
    commands: { getAll: async () => commands },
    tabs: { create: async () => {} },
  };
};

const startServer = async () => {
  const server = http.createServer(async (request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);

    if (requestPath.includes("..")) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    const mimeType = MIME_TYPES[path.extname(requestPath)];
    if (mimeType === undefined) {
      response.writeHead(404).end("Not Found");
      return;
    }

    try {
      const body = await fs.readFile(path.join(repoRoot, requestPath));
      response.writeHead(200, { "Content-Type": mimeType }).end(body);
    } catch {
      response.writeHead(404).end("Not Found");
    }
  });

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  return { server, origin: `http://127.0.0.1:${server.address().port}` };
};

const assertPngSize = async (filePath, expectedWidth, expectedHeight) => {
  const header = await fs.readFile(filePath);
  const width = header.readUInt32BE(16);
  const height = header.readUInt32BE(20);

  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(
      `${filePath} is ${width}x${height}; the Chrome Web Store requires exactly ${expectedWidth}x${expectedHeight}`
    );
  }

  return `${width}x${height}`;
};

const renderShot = async ({ browser, origin, shot }) => {
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: shot.width, height: shot.height, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: shot.colorScheme },
    ]);
    await page.evaluateOnNewDocument(installChromeStub, SHORTCUT_SETS);

    const url = new URL(shot.template, origin);
    for (const [key, value] of Object.entries(shot.query)) {
      url.searchParams.set(key, value);
    }

    await page.goto(url.href, { waitUntil: "load" });

    if (shot.awaitPopup) {
      await page.waitForFunction(() => {
        const frame = document.querySelector("iframe");
        const doc = frame?.contentDocument;
        return doc !== null && doc !== undefined && doc.querySelectorAll(".shortcut").length === 4;
      });

      await page.evaluate(() => {
        const frame = document.querySelector("iframe");
        frame.style.height = `${frame.contentDocument.documentElement.scrollHeight}px`;
      });
    }

    await page.evaluate(() => document.fonts.ready);

    const outputPath = path.join(repoRoot, shot.output);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await page.screenshot({ path: outputPath, type: "png" });

    const size = await assertPngSize(outputPath, shot.width, shot.height);
    console.log(`wrote ${shot.output} (${size})`);
  } finally {
    await page.close();
  }
};

const main = async () => {
  try {
    await fs.access(distPopup);
  } catch {
    console.error(`Missing ${path.relative(repoRoot, distPopup)}; run "npm run build" first.`);
    process.exit(1);
  }

  const executablePath = process.env.CHROME_PATH ?? defaultChrome;
  try {
    await fs.access(executablePath);
  } catch {
    console.error(`Chrome not found at ${executablePath}; set CHROME_PATH to a Chrome binary.`);
    process.exit(1);
  }

  const { server, origin } = await startServer();
  let browser;

  try {
    browser = await puppeteer.launch({ headless: true, executablePath });

    for (const shot of SHOTS) {
      await renderShot({ browser, origin, shot });
    }
  } finally {
    if (browser !== undefined) {
      await browser.close();
    }
    server.close();
  }

  console.log("Store assets generated successfully.");
};

await main();
