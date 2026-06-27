## 1. Repository & branch strategy

- [ ] 1.1 Create the long-lived `release` branch from `main` and document the "land on `release`, tag to ship" convention (design D2; spec: Release gated to the release branch)
- [ ] 1.2 Confirm `package-lock.json` is committed and current so `npm ci` works in CI (design Risks)
- [ ] 1.3 Decide and record the first release version and whether pre-release tags (`v*-rc.*`) are in scope (design Open Questions)

## 2. CI validation workflow (`ci.yml`)

- [ ] 2.1 Repurpose `.github/workflows/build.yml` into `ci.yml` triggered on push to `main` and `release` and on pull requests (design D3; spec: Validation CI without distribution)
- [ ] 2.2 Keep the macOS (universal) + Windows build/type-check matrix; ensure it never creates a Release, only uploads inspection artifacts (spec: Validation CI without distribution)
- [ ] 2.3 Add `ubuntu-22.04` to the validation matrix with the WebKitGTK/AppIndicator apt dependencies (design D6)

## 3. Version bump helper (`version.yml`)

- [ ] 3.1 Add a `workflow_dispatch` workflow with a `bump` input of `patch` / `minor` / `major` that checks out `release` (design D4; spec: Assisted version bump)
- [ ] 3.2 Read the latest `v*` tag (`git describe --tags --abbrev=0`) and compute the next semver from the chosen bump magnitude (design D4; spec: Assisted version bump)
- [ ] 3.3 Write the computed version into `package.json`, `Cargo.toml`, and `src-tauri/tauri.conf.json`, then commit `chore(release): vX.Y.Z` to `release` (design D1, D4)
- [ ] 3.4 Push the `vX.Y.Z` tag from the release branch so it is an ancestor of `release` by construction (design D2, D4; spec: Pushed tag triggers distribution)

## 4. Release workflow (`release.yml`)

- [ ] 4.1 Trigger on `push` of tags matching `v*` (spec: Tag-driven release trigger)
- [ ] 4.2 Add the release-branch guard: fetch `origin/release` and fail fast unless `git merge-base --is-ancestor $GITHUB_SHA origin/release` (design D2; spec: Release gated to the release branch)
- [ ] 4.3 Parse the version from the tag (`${GITHUB_REF_NAME#v}`) and stamp it into all three manifests before building (design D1; spec: Tag is the single source of truth for version)
- [ ] 4.4 Build with a matrix of `macos-latest` (`--target universal-apple-darwin`), `windows-latest`, and `ubuntu-22.04`, installing Linux deps and Rust apple targets as needed (design D5, D6; spec: Cross-platform installer build)
- [ ] 4.5 Use `tauri-apps/tauri-action` to build bundles and create/update a **draft** GitHub Release named for the version with all platform assets attached (design D5; spec: Publish a GitHub Release with installers attached)
- [ ] 4.6 Add a release-notes template that includes the unsigned-install warnings for macOS and Windows (design D7; spec: Document unsigned-install warnings)

## 5. Documentation

- [ ] 5.1 Update `README.md` with the release/tag flow and how end users open unsigned builds on macOS (Gatekeeper) and Windows (SmartScreen) (spec: Document unsigned-install warnings)
- [ ] 5.2 Note in `README.md` that signing/notarization and package-manager channels (Homebrew Cask, winget) are a planned follow-up (design D7, Non-Goals)

## 6. Verify

- [ ] 6.1 Dry-run with a throwaway pre-release tag (or the bump helper) and confirm the ancestry guard passes on `release` and fails for a tag off `release` (design D2, Migration step 3)
- [ ] 6.2 Confirm the matrix builds macOS, Windows, and Linux and that a draft Release is created with all assets attached and the correct version (spec: Cross-platform installer build; Publish a GitHub Release)
- [ ] 6.3 Verify the produced installers report the tag's version on all three manifests (spec: Tag is the single source of truth for version)
- [ ] 6.4 Publish the reviewed draft as the first real release; verify rollback by deleting a test tag + draft (design Migration steps 4–5)

## 7. Future-proofing (no implementation now)

- [ ] 7.1 Leave clearly-marked env slots in `release.yml` for macOS notarization (`APPLE_*`) and Windows signing so the deferred signing change is additive (design D7, Non-Goals)
