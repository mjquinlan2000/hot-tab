// Copies package.json's version into public/manifest.json. Runs as npm's `version` lifecycle
// hook, so `npm version <patch|minor|major|x.y.z>` bumps package.json, package-lock.json and the
// manifest in one commit before tagging v<version>. The release workflow rejects a tag that
// disagrees with either file.
import fs from "node:fs/promises";

const packageUrl = new URL("../package.json", import.meta.url);
const manifestUrl = new URL("../public/manifest.json", import.meta.url);

const { version } = JSON.parse(await fs.readFile(packageUrl, "utf8"));
const manifest = await fs.readFile(manifestUrl, "utf8");

// Rewrite only the version line so the manifest's hand formatting survives.
const versionLine = /^(\s*"version":\s*)"[^"]*"/gm;
const matches = manifest.match(versionLine) ?? [];
if (matches.length !== 1) {
  throw new Error(`expected one "version" key in public/manifest.json, found ${matches.length}`);
}

await fs.writeFile(manifestUrl, manifest.replace(versionLine, `$1"${version}"`));
console.log(`public/manifest.json version -> ${version}`);
