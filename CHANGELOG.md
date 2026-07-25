# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2026-07-25

### Fixed

- Added `repository`, `bugs`, and `homepage` package metadata so npm links back to the GitHub repository, issue tracker, and README.

## [1.0.0] - 2026-07-24

### Added

- Initial standalone release of `kysely-sensitive-param`.
- `SensitiveParam`, `markSensitive`, `isSensitive`, and `getSensitiveValue`.
- `SensitiveUnwrappingDialect` for unwrapping sensitive parameters before query execution.
- `makeLogging` with configurable sensitive placeholders.
- Vitest coverage for `SensitiveParam`, logging behavior, and dialect wrapping behavior.
- GitHub Actions workflow for lint, typecheck, test, and build.
- ESLint setup using an `eslint.config.mts` flat config.
