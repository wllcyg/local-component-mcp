# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.2] - 2026-06-23

### Added
- Added automated unit test suite using `vitest`.
- Configured GitHub action workflows for validation.

### Changed
- Upgraded `@modelcontextprotocol/sdk` from `^0.6.0` to `^1.0.1` (compiled and tested compatibility with `1.29.0`).
- Improved `package.json` metadata by enriching description and adding package keywords to improve NPM discoverability.

### Removed
- Removed unused dependency `tiktoken` to reduce installation size and build complexity.

---

## [1.2.0] - 2026-06-22

### Added
- **React Components Support**: Integrated `react-docgen` to support AST parsing for React files (`.tsx`, `.jsx`).
- **React State Management Support**: Added parsing logic in `get_store_detail` for:
  - **Zustand** (`create(...)` / `create()(...)`)
  - **Redux Toolkit** (`createSlice(...)` with local scope variable lookups)
  - **Jotai** (`atom(...)`)
- Added support for scanning `.tsx` and `.jsx` extensions in `search_stores` tool.

---

## [1.1.2] - 2026-06-22

### Fixed
- Fixed bug where file resolver failed on empty configuration files.
- Unified error prompts to Chinese for better localized AI developer experience.

---

## [1.1.0] - 2026-06-22

### Added
- **Usages Lookup**: Added new tool `get_component_usages` to find all occurrences of a component in the workspace (import statements, template/JSX tags, and script variable calls).
- **Alias Resolution**: Automatically resolve project-defined path aliases (e.g. `@/*`) by reading `tsconfig.json`, `vite.config.ts`, and `vue.config.js`.
- **mtime Caching**: Implemented incremental alias configuration loading based on file change times (`mtime`) to avoid performance lags without server restarts.

---

## [1.0.0] - 2026-06-21

### Added
- Initial release of `local-component-mcp` server.
- Supported Vue components parsing (`vue-docgen-api`) for Props, Events, Slots.
- Supported Vuex / Pinia (Option & Setup styles) store parsing.
