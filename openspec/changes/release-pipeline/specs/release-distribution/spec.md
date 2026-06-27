## ADDED Requirements

### Requirement: Tag-driven release trigger

The system SHALL begin building and distributing installers only in response to a version tag of the form `vX.Y.Z` being pushed, and SHALL NOT distribute on ordinary branch pushes or pull requests.

#### Scenario: Version tag starts a release

- **WHEN** a `vX.Y.Z` tag is pushed to the repository
- **THEN** the release pipeline runs and produces distributable installers

#### Scenario: Branch push does not distribute

- **WHEN** code is pushed to any branch without a new version tag
- **THEN** no release is built or published

### Requirement: Release gated to the release branch

The system SHALL distribute only when the tagged commit is contained in the `release` branch, and SHALL fail the release without producing or publishing artifacts when the tagged commit is not on the `release` branch.

#### Scenario: Tag on the release branch proceeds

- **WHEN** the tagged commit is an ancestor of the `release` branch tip
- **THEN** the release pipeline continues and builds the installers

#### Scenario: Tag off the release branch is rejected

- **WHEN** the tagged commit is not contained in the `release` branch
- **THEN** the pipeline stops before building and publishes nothing

### Requirement: Tag is the single source of truth for version

The system SHALL derive the release version from the pushed tag and SHALL apply that version to the application manifests (`package.json`, `Cargo.toml`, and the Tauri configuration) used to build the installers, so that every produced installer reports the tag's version.

#### Scenario: Version applied to all manifests

- **WHEN** a release builds from tag `vX.Y.Z`
- **THEN** the build uses version `X.Y.Z` across all three manifests and the resulting installers report `X.Y.Z`

#### Scenario: Committed manifest version is overridden by the tag

- **WHEN** the committed manifest version differs from the tag version at release time
- **THEN** the tag version is used for the build rather than the committed value

### Requirement: Cross-platform installer build

The system SHALL build distributable installers for macOS, Windows, and Linux for each release: a macOS disk image built as a universal (Intel + Apple Silicon) binary, a Windows installer, and Linux packages including an AppImage and at least one of `.deb`/`.rpm`.

#### Scenario: All three platforms are built

- **WHEN** a release is triggered
- **THEN** macOS, Windows, and Linux installers are produced for that release

#### Scenario: macOS binary is universal

- **WHEN** the macOS installer is built
- **THEN** it contains a universal binary that runs on both Intel and Apple Silicon

### Requirement: Publish a GitHub Release with installers attached

The system SHALL publish a GitHub Release named for the version with the per-platform installers attached as downloadable assets, and SHALL create it as a draft so it can be reviewed before it is made public.

#### Scenario: Release carries platform assets

- **WHEN** the cross-platform build completes for a tag
- **THEN** a GitHub Release for that version is created with the macOS, Windows, and Linux installers attached

#### Scenario: Draft awaits review

- **WHEN** the release is first created
- **THEN** it is a draft that a maintainer can review and publish, rather than being immediately public

### Requirement: Assisted version bump

The system SHALL provide a manually triggered action that, given a bump magnitude of patch, minor, or major, computes the next version from the most recent version tag, updates the three manifests on the `release` branch, commits the change, and pushes a corresponding `vX.Y.Z` tag.

#### Scenario: Maintainer requests a bump

- **WHEN** a maintainer triggers the bump action and selects patch, minor, or major
- **THEN** the next version is computed from the latest tag, the manifests are updated and committed on the `release` branch, and a matching `vX.Y.Z` tag is pushed

#### Scenario: Pushed tag triggers distribution

- **WHEN** the bump action pushes the new version tag
- **THEN** the tag-driven release pipeline runs for that version

#### Scenario: Manual tagging remains supported

- **WHEN** a maintainer instead creates and pushes a `vX.Y.Z` tag by hand on the `release` branch
- **THEN** the release pipeline runs for that version

### Requirement: Validation CI without distribution

The system SHALL run build and type-check validation on pushes to the `main` and `release` branches and on pull requests, and that validation SHALL NOT publish a release.

#### Scenario: Push validates without releasing

- **WHEN** code is pushed to `main` or `release`
- **THEN** the project is built and type-checked and no GitHub Release is created

#### Scenario: Pull request is validated

- **WHEN** a pull request is opened or updated
- **THEN** the project is built and type-checked without publishing anything

### Requirement: Document unsigned-install warnings

While installers are distributed unsigned, the system SHALL document, in the release notes and project README, that macOS and Windows will show security warnings for unsigned applications and how a user can proceed.

#### Scenario: Warnings are documented for users

- **WHEN** an unsigned release is published
- **THEN** the release notes and README explain the macOS Gatekeeper and Windows SmartScreen warnings and the steps to open the app anyway
