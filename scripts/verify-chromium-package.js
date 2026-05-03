#!/usr/bin/env node

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const zipPath = process.argv[2] || "dist-chromium.zip";
const resolvedZipPath = path.resolve(process.cwd(), zipPath);

function fail(message) {
  console.error(`Chromium package verification failed: ${message}`);
  process.exit(1);
}

function unzip(args) {
  try {
    return execFileSync("unzip", args, { encoding: "utf8" });
  } catch (error) {
    const details = error.stderr || error.message;
    fail(details.trim());
  }
}

if (!fs.existsSync(resolvedZipPath)) {
  fail(`zip not found at ${resolvedZipPath}`);
}

const entries = unzip(["-Z1", resolvedZipPath])
  .split(/\r?\n/)
  .map((entry) => entry.trim())
  .filter(Boolean);

const entrySet = new Set(entries);
const requiredRootEntries = [
  "manifest.json",
  "popup.html",
  "options.html",
  "background.js",
  "contentScript.js",
  "contentScript.css",
  "logo48.png",
  "logo128.png",
];

for (const entry of requiredRootEntries) {
  if (!entrySet.has(entry)) {
    fail(`missing required root entry: ${entry}`);
  }
}

const forbiddenPatterns = [
  /^dist-chromium\//,
  /(^|\/)README\.md$/i,
  /(^|\/)robots\.txt$/i,
  /(^|\/)\.DS_Store$/i,
  /^locales\//,
  /^i18n\//,
];

const forbiddenEntry = entries.find((entry) =>
  forbiddenPatterns.some((pattern) => pattern.test(entry))
);

if (forbiddenEntry) {
  fail(`unexpected packaged entry: ${forbiddenEntry}`);
}

let manifest;
try {
  manifest = JSON.parse(unzip(["-p", resolvedZipPath, "manifest.json"]));
} catch (error) {
  fail(`manifest.json is not valid JSON: ${error.message}`);
}

if (manifest.manifest_version !== 3) {
  fail("manifest.json is not a Manifest V3 file");
}

if (!manifest.background || manifest.background.service_worker !== "background.js") {
  fail("manifest.json does not point to the packaged background service worker");
}

const forbiddenPermissions = new Set(["cookies"]);
const unexpectedPermission = (manifest.permissions || []).find((permission) =>
  forbiddenPermissions.has(permission)
);
if (unexpectedPermission) {
  fail(`unexpected permission in manifest.json: ${unexpectedPermission}`);
}

const forbiddenHostFragments = [
  "aistudio.google.com",
  "notebooklm.google.com",
];
const unexpectedHost = [
  ...(manifest.host_permissions || []),
  ...((manifest.content_scripts || []).flatMap((script) => script.matches || [])),
  ...((manifest.web_accessible_resources || []).flatMap((resource) => resource.matches || [])),
].find((pattern) => forbiddenHostFragments.some((host) => pattern.includes(host)));

if (unexpectedHost) {
  fail(`unexpected MVP-out host in manifest.json: ${unexpectedHost}`);
}

console.log(`Chromium package verified: ${zipPath}`);
