import fs from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const API_ROOT = "https://chromewebstore.googleapis.com";
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 300_000;

const parseArgs = (argv) => {
  const options = { zip: null, expectVersion: null, skipPublish: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--zip") {
      options.zip = argv[index + 1] ?? null;
      index += 1;
    } else if (arg === "--expect-version") {
      options.expectVersion = argv[index + 1] ?? null;
      index += 1;
    } else if (arg === "--skip-publish") {
      options.skipPublish = true;
    } else {
      console.error(`Unknown argument: ${arg}`);
      console.error(
        "Usage: node scripts/publish-cws.mjs --zip <path> [--expect-version <x.y.z>] [--skip-publish]"
      );
      process.exit(1);
    }
  }

  return options;
};

const requireEnv = (name) => {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value.trim();
};

const failWithResponse = async (label, response) => {
  const body = await response.text();
  console.error(`${label} failed: ${response.status} ${response.statusText}`);
  console.error(body);
  process.exit(1);
};

const upload = async ({ token, item, zipBytes }) => {
  const response = await fetch(`${API_ROOT}/upload/v2/${item}:upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/zip",
    },
    body: zipBytes,
  });

  if (!response.ok) {
    await failWithResponse("Upload", response);
  }

  return response.json();
};

const fetchStatus = async ({ token, item }) => {
  const response = await fetch(`${API_ROOT}/v2/${item}:fetchStatus`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    await failWithResponse("Fetch status", response);
  }

  return response.json();
};

const awaitUpload = async ({ token, item, uploadResult }) => {
  const state = uploadResult.uploadState;

  if (state === "FAILED" || state === "NOT_FOUND") {
    console.error(`Upload reported uploadState=${state}`);
    console.error(JSON.stringify(uploadResult, null, 2));
    process.exit(1);
  }

  if (state === "SUCCEEDED") {
    return uploadResult.crxVersion ?? null;
  }

  console.log(`uploadState=${state}; polling fetchStatus for completion...`);
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let lastState = state;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const status = await fetchStatus({ token, item });
    const revision = status.submittedItemRevisionStatus ?? {};
    lastState = revision.lastAsyncUploadState ?? "UPLOAD_STATE_UNSPECIFIED";

    if (lastState === "SUCCEEDED") {
      const channels = revision.distributionChannels ?? [];
      return channels[0]?.crxVersion ?? null;
    }

    if (lastState === "FAILED" || lastState === "NOT_FOUND") {
      console.error(`Upload reported lastAsyncUploadState=${lastState}`);
      console.error(JSON.stringify(status, null, 2));
      process.exit(1);
    }

    console.log(`lastAsyncUploadState=${lastState}; still waiting...`);
  }

  console.error(
    `Upload did not finish within ${POLL_TIMEOUT_MS / 1000}s; last observed state was ${lastState}`
  );
  process.exit(1);
};

const publish = async ({ token, item }) => {
  const response = await fetch(`${API_ROOT}/v2/${item}:publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ publishType: "DEFAULT_PUBLISH" }),
  });

  if (!response.ok) {
    await failWithResponse("Publish", response);
  }

  return response.json();
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (options.zip === null) {
    console.error("Missing required argument: --zip <path>");
    process.exit(1);
  }

  let zipBytes;
  try {
    zipBytes = await fs.readFile(options.zip);
  } catch (err) {
    console.error(`Cannot read zip at ${options.zip}: ${err.message}`);
    process.exit(1);
  }

  const token = requireEnv("CWS_ACCESS_TOKEN");
  const publisherId = requireEnv("CWS_PUBLISHER_ID");
  const extensionId = requireEnv("CWS_EXTENSION_ID");
  const item = `publishers/${publisherId}/items/${extensionId}`;

  const uploadResult = await upload({ token, item, zipBytes });
  const crxVersion = await awaitUpload({ token, item, uploadResult });

  if (options.expectVersion !== null && options.expectVersion !== crxVersion) {
    console.error(
      `Version mismatch: expected ${options.expectVersion}, store reports crxVersion=${crxVersion}`
    );
    process.exit(1);
  }

  console.log(`uploaded ${item} crxVersion=${crxVersion} uploadState=SUCCEEDED`);

  if (options.skipPublish) {
    console.log("skip-publish set; draft left unpublished");
    process.exit(0);
  }

  const publishResult = await publish({ token, item });
  console.log(`published ${item} state=${publishResult.state}`);

  for (const warning of publishResult.warningInfo?.warnings ?? []) {
    console.log(`warning: ${warning.reason}: ${warning.description}`);
  }
};

await main();
