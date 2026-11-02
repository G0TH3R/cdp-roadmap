# Changelog

All notable changes are documented here.

## [0.7.1]

### Fixed

- Unassigned-project timeline lanes show **Mixed categories** when their visible activities have distinct categories, including blank versus assigned; individual categories and named-project validation are unchanged.
- Added mixed-category and filtered-view regression coverage and corrected the UI adapter/filter documentation.
- CI now rejects stale tracked generated assets after builds and tests.

## [0.7.0]

### Added

- Separate optional Project Category field, fixed five-category filter and labels in register, project lanes and details.
- Legacy Uncategorized support, category consistency validation and matching Studio controls.
- Literal activity search, Fit / Months / Weeks scale controls and Today navigation.
- Bounded Lookup Editor discovery that does not block read-only viewing when editing is unavailable.

### Changed

- More compact, responsive workspace and corrected Project Schedule heading.
- App/view read and CSV read/write defaults are all-role, with admin-only definition writes; destination policy review is required.
- CSV-first editing workflow, SHC lookup preservation configuration and destination-specific upgrade guidance; no KV Store or native write backend.
- Personal app-author metadata/Studio author line removed; required third-party notices preserved.
- Public seed replaced with eight entirely fictional DEMO rows covering all five categories and statuses. Operational plans, snapshots and target-specific tooling are excluded.
- Updated public-source tests, deterministic package workflow, synthetic screenshots and release/privacy guidance.

## [0.4.1] - 2026-09-20

### Changed

- Increased fiscal-week gridline contrast with dedicated dark/light week and month tokens.
- Preserved the visual hierarchy between week lines, month boundaries, and the two-pixel Today marker.
- Replaced environment-specific seed examples with eight reviewed illustrative release-planning rows for public distribution.

### Verified

- JavaScript helper, rendering, theme, UI-contract, adapter, and timezone tests.
- Python app and deterministic package contracts.
- Exact package/source/manifest byte comparison.

## [0.4.0] - 2026-09-20

- Added optional short timeline labels, federal fiscal-week subdivisions, and a browser-local Today marker.
- Added project grouping and stable theme persistence.

## [0.3.2] - 2026-09-20

- Refined project lane rendering, narrow-layout behavior, and package verification.

## [0.3.0] - 2026-09-20

- Introduced project/activity grouping and the production React canvas.

## [0.2.0] - 2026-09-19

- Added bounded SplunkJS lookup loading, validation, filters, details, and Dashboard Studio fallback.
