## Why

Port Killer has no automated way to cut a release: the existing `build.yml` only compiles macOS + Windows on every push and uploads loose artifacts — it never publishes a GitHub Release, never versions anything, and leaves the three version manifests (`package.json`, `Cargo.toml`, `tauri.conf.json`) to drift by hand. There is also no agreed branch/tag strategy, so "ship a version" is an undocumented manual ritual. This change turns the build into a tag-driven release pipeline that produces downloadable installers for macOS, Windows, and Linux from a single, controlled trigger.

## What Changes

- Establish a **`release` branch + `vX.Y.Z` tag** strategy as the release contract: code lands on `release` (CI validates only), and **distribution happens only when a tag is created on the `release` branch**.
- Add a **release workflow** (`release.yml`) triggered on `v*` tag pushes that builds macOS (universal), Windows, and Linux bundles and publishes a **GitHub Release** with the installers attached.
- Add a **release-branch guard**: the workflow verifies the tagged commit is contained in `origin/release` and aborts the release if it is not, so a stray tag elsewhere cannot trigger distribution.
- Make the **git tag the single source of truth for the version**: the workflow stamps the tag's version into `package.json`, `Cargo.toml`, and `tauri.conf.json` at build time so artifacts can never carry a drifted version.
- Add a **bump helper** (`version.yml`, `workflow_dispatch` with a `patch` / `minor` / `major` choice) that reads the latest tag, computes the next version, writes all three manifests on `release`, commits, and pushes the tag — which then triggers `release.yml`. Manual `git tag vX.Y.Z` remains supported.
- Repurpose the existing `build.yml` into a **CI validation workflow** (`ci.yml`) that builds/type-checks on pushes to `main` and `release` and on PRs, **without** publishing anything.
- **Enable Linux** in the build matrix (`.AppImage` + `.deb`/`.rpm`) alongside macOS and Windows.
- Ship **unsigned** for now and **document the Gatekeeper / SmartScreen warnings** in the release notes and README.

Non-goals (explicitly deferred to a future change once signing credentials exist): macOS notarization, Windows Authenticode signing, and publishing to package managers (Homebrew Cask, winget, Flathub) — those all depend on signed artifacts. Also out of scope: semantic-release / conventional-commit-driven auto-versioning (the human creates the tag).

## Capabilities

### New Capabilities
- `release-distribution`: Build and publish versioned, cross-platform installers for macOS, Windows, and Linux from a controlled, tag-driven release trigger that is gated to the `release` branch, with a single source-of-truth version and an assisted version-bump path.

### Modified Capabilities
<!-- None: openspec/specs/ is empty and no existing product capability's requirements change. This adds release/distribution behavior only. -->

## Impact

- **CI/CD** (`.github/workflows/`): `build.yml` → `ci.yml` (validation only); new `release.yml` (tag-triggered build + GitHub Release); new `version.yml` (bump helper). Adds Linux runner (`ubuntu-22.04`) and its WebKitGTK/AppIndicator apt dependencies.
- **Version manifests**: `package.json`, `Cargo.toml`, `src-tauri/tauri.conf.json` become workflow-written outputs derived from the tag rather than hand-edited inputs.
- **Repository process**: introduces a long-lived `release` branch and a `vX.Y.Z` tag convention; releases are created as drafts for review before publishing.
- **Docs** (`README.md`): document the release flow and the temporary unsigned-install warnings for end users.
- **No application runtime code changes**: this change touches build, versioning, and packaging only — not the Rust backend or web UI.
- **Key risks to de-risk**: (1) GitHub tag triggers are branch-agnostic, so the ancestry guard must be correct; (2) `ubuntu-latest`/24.04 breaks Tauri's WebKitGTK build, so the Linux runner must be pinned to `22.04`; (3) the three manifests must be stamped consistently from the tag to avoid bundler version mismatches.
