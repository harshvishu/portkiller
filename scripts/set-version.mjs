// Sets the release version across all three manifests from a single argument.
// Used by the release pipeline (stamp from tag) and the bump helper.
//
//   node scripts/set-version.mjs 1.2.3
//
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Invalid version: "${version}". Expected X.Y.Z[-prerelease].`);
  process.exit(1);
}

// package.json
const pkgPath = "package.json";
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// src-tauri/tauri.conf.json
const confPath = "src-tauri/tauri.conf.json";
const conf = JSON.parse(readFileSync(confPath, "utf8"));
conf.version = version;
writeFileSync(confPath, JSON.stringify(conf, null, 2) + "\n");

// src-tauri/Cargo.toml — only the [package] version (first line-anchored match)
const cargoPath = "src-tauri/Cargo.toml";
const cargo = readFileSync(cargoPath, "utf8");
const cargoVersionRe = /^version = ".*"$/m;
if (!cargoVersionRe.test(cargo)) {
  console.error(`Could not find a [package] version line in ${cargoPath}`);
  process.exit(1);
}
writeFileSync(cargoPath, cargo.replace(cargoVersionRe, `version = "${version}"`));

console.log(`Set version to ${version} in package.json, tauri.conf.json, Cargo.toml`);
