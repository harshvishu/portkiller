## Context

Port Killer is a Tauri 2 app (Rust backend + web UI) targeting macOS, Windows, and Linux. The only automation today is `.github/workflows/build.yml`, which builds macOS (universal) and Windows on every push to `main` and on PRs and uploads loose bundle artifacts. There is:

- no published GitHub Release and no download surface for end users,
- no versioning discipline — `package.json`, `Cargo.toml`, and `src-tauri/tauri.conf.json` all say `1.0.0` and are edited by hand,
- no branch/tag release convention (only `main` exists; there are no tags),
- no code signing or notarization configured.

The desired flow, from exploration: work lands on a long-lived `release` branch (CI validates it), and a **human-created `vX.Y.Z` tag on that branch** is the one and only thing that triggers distribution. The version is decided by humans (no semantic-release), but the tedious parts — computing the next number and syncing three manifests — should be assisted. Signing and package-manager distribution (Homebrew Cask, winget, Flathub) are deferred until signing credentials exist, because those channels require signed/notarized artifacts anyway.

## Goals / Non-Goals

**Goals:**
- A tag-driven release pipeline: pushing a `vX.Y.Z` tag builds and publishes installers for macOS, Windows, and Linux.
- Honor "tag must be on `release`" literally, despite Git tags being branch-agnostic.
- Make the git tag the single source of truth for the version; artifacts can never carry a drifted version.
- Provide an assisted version bump (`patch`/`minor`/`major`) so no one hand-edits three manifests or hand-computes the next number.
- Keep validation CI (build/type-check) separate from release, running on `main`, `release`, and PRs without publishing.
- Produce a clean, reviewable GitHub Release (draft → publish).
- Enable Linux bundles now.

**Non-Goals:**
- macOS notarization and Windows Authenticode signing (deferred; tracked as a follow-up change).
- Publishing to Homebrew Cask, winget, Flathub, Snap, or any package manager (deferred — depends on signing).
- semantic-release / conventional-commit-driven automatic version inference. Humans pick the bump.
- Mobile targets, auto-update server, or delta updates.
- Changing any application runtime behavior (backend or UI).

## Decisions

### D1: The git tag is the single source of truth for the version
Releases are identified by an annotated/lightweight tag `vX.Y.Z`. The release workflow parses the version from the tag ref (`${GITHUB_REF_NAME#v}`) and **stamps** it into `package.json`, `Cargo.toml`, and `src-tauri/tauri.conf.json` during the job (a build-time write, not necessarily committed) before invoking the bundler. This guarantees the three manifests and the produced installers all agree with the tag regardless of what is committed.
*Alternative considered:* read the version from `tauri.conf.json` and require it to match the tag — rejected because it reintroduces manual manifest editing and a class of "tag says 1.2.0 but config says 1.1.0" failures.

### D2: Enforce "tag on `release`" with an ancestry guard
GitHub Actions `on: push: tags:` fires for any matching tag and carries no branch identity. The release job's first step fetches `origin/release` and checks that the tagged commit is an ancestor (`git merge-base --is-ancestor $GITHUB_SHA origin/release`). If not, it fails fast before building. This makes the documented rule — "only a tag on the release branch distributes" — actually enforced.
*Alternatives considered:* (a) trust the `v*` pattern by convention — rejected as having no guard; (b) auto-tag on push to `release` — rejected because it contradicts "we create the tag." The guard is the smallest mechanism that honors intent.

### D3: Two-workflow split — `ci.yml` (validate) vs `release.yml` (distribute)
`build.yml` is repurposed into `ci.yml`: it builds and type-checks on push to `main`/`release` and on PRs, and uploads artifacts only for inspection — it never creates a Release. `release.yml` is the only workflow that publishes, and only on `v*` tags. This keeps the fast feedback loop on every push while making distribution a deliberate, narrow trigger.
*Alternative considered:* one workflow with conditional release steps — rejected because mixing triggers makes the "what actually ships" logic hard to read and easy to misfire.

### D4: Assisted bump helper as a separate dispatch workflow
`version.yml` is a `workflow_dispatch` with an `inputs.bump` choice of `patch`/`minor`/`major`. It runs on `release`, reads the latest `v*` tag (`git describe --tags --abbrev=0`), computes the next semver, writes all three manifests, commits (`chore(release): vX.Y.Z`), and pushes the tag. The tag push then triggers `release.yml`. This is the concrete meaning of "auto version increment" once semantic-release is excluded: the human picks the magnitude, the machine does the arithmetic and the file edits.
*Alternatives considered:* (a) pure manual `git tag` only — kept as a supported fallback but not the primary path, since it leaves manifests stale (D1 still saves the artifact); (b) semantic-release — explicitly rejected by the user.

### D5: Use the official `tauri-apps/tauri-action` to build and release
`release.yml` uses `tauri-apps/tauri-action`, which builds the bundle per-OS and creates/updates a GitHub Release with the platform assets attached, keyed by `tagName`/`releaseName`. It is configured to create a **draft** release so a human reviews assets before publishing. The matrix runs `macos-latest` (universal via `--target universal-apple-darwin`), `windows-latest`, and `ubuntu-22.04`.
*Alternative considered:* hand-rolled `softprops/action-gh-release` + manual `tauri build` + glob upload — rejected as more moving parts; `tauri-action` already maps bundle outputs to release assets across all three OSes.

### D6: Pin the Linux runner to `ubuntu-22.04`
Tauri's Linux build needs WebKitGTK 4.1 / AppIndicator. `ubuntu-latest` has moved to 24.04, where the WebKitGTK packaging changes routinely break Tauri builds. The matrix pins `ubuntu-22.04` and installs `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, and `patchelf` (matching the block already stubbed in `build.yml`).
*Alternative considered:* `ubuntu-latest` — rejected as a known-bad target for Tauri today.

### D7: Ship unsigned now; document the warnings; design for a clean signing follow-up
Without an Apple Developer ID or Windows cert, bundles are unsigned: macOS Gatekeeper requires right-click→Open, Windows SmartScreen shows "unknown publisher." The release notes template and README document this explicitly. The workflow is structured so that adding signing later is additive — macOS notarization env (`APPLE_*`) and Windows signing env slot into `tauri-action` without restructuring — and that follow-up is what unlocks Homebrew Cask + winget.
*Alternative considered:* block release until signing exists — rejected; an unsigned-but-documented download is more useful than no download, and the dependency order (signing → package managers) is already correct.

## Risks / Trade-offs

- **Branch-agnostic tags could distribute unintended commits** → D2 ancestry guard fails the job unless the tagged commit is on `origin/release`.
- **`ubuntu-latest` drift breaks Linux builds** → D6 pins `ubuntu-22.04` and installs explicit GTK deps.
- **Manifest/tag version mismatch produces mislabeled installers** → D1 stamps all three manifests from the tag at build time.
- **Bump helper pushes a tag that the release branch guard then rejects** → `version.yml` runs on and commits to `release` before tagging, so the tag is always an ancestor of `release` by construction.
- **Unsigned binaries erode user trust / Homebrew Cask + winget won't accept them cleanly** → documented warnings now; deferred signing change unblocks both channels together.
- **Draft releases pile up if not published** → acceptable; review-before-publish is the intended safety valve and is a one-line switch to auto-publish later.
- **`npm ci` requires a committed lockfile** → `package-lock.json` is present; CI depends on it staying committed.

## Migration Plan

1. Create the long-lived `release` branch from `main`.
2. Land `ci.yml` (replacing `build.yml`), `release.yml`, and `version.yml` on `main`, then bring them to `release`.
3. Dry-run: run the `version.yml` bump helper (or push a throwaway pre-release tag like `v1.0.1-rc.1`) and confirm the guard, the matrix build (incl. Linux), and the draft Release with all assets.
4. Cut the first real release by bumping to the intended `vX.Y.Z` and publishing the reviewed draft.
5. Rollback: delete the tag and the draft Release; no production system is affected because distribution is download-only.

## Open Questions

- Should the first tagged release be `v1.0.0` (current manifest value) or start at `v1.0.1` to keep `1.0.0` as the pre-pipeline baseline?
- Should `release.yml` also fire on pre-release tags (`v*-rc.*`, `v*-beta.*`) and mark those GitHub Releases as "pre-release," or only on final `vX.Y.Z`?
- ~~Auto-publish the Release or keep the draft-then-manual-publish gate?~~ **Resolved: manual publish** — the Release is always created as a draft (D5) and a maintainer reviews and publishes it. Auto-publish is not enabled by default.
