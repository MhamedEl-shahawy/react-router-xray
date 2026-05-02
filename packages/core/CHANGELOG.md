# react-router-xray-core

## 2.1.0

### Minor Changes

- ### react-router-xray-core

  The browser `analyzeRoutes` implementation shipped under `react-router-xray-core/wasm` now reports **structural clarity**: scores run **0–100 where higher is better**, derived from pathname penalty buckets (matched chain breadth, deepest segment depth, `:param` tokens, `*` markers). `AnalysisMetrics` includes `clarityScore`, `structuralPenalty`, `tier`, `contributors`, and `headline`; `AnalysisResult.score` stays aligned with `clarityScore`. Insights were rewritten around tiers instead of the legacy inverted heuristic.

  ### react-router-xray-react

  The dev overlay adds a **Structural clarity** section (tier badge, headline, penalty breakdown table, collapsible formula copy). WASM stays lazily loaded; the panel remains portaled with safer shortcuts and data-router fallbacks. Fixes Vitest stability via `@testing-library/react` cleanup after each test.

  ### vite-plugin-react-router-xray

  Rebuilt against the updated core analyzer exports so workspace installs remain semver-aligned after consumers bump core.

## 2.0.2

### Patch Changes

- Normalize Vite plugin route input from arrays and newline strings, refresh docs/examples to the tested options format, and improve CLI terminal report presentation.

## 2.0.1

### Patch Changes

- Fix core package exports to point to real JavaScript files in dist so downstream consumers can resolve module entrypoints correctly.

## 2.0.0

### Major Changes

- Publish initial 1.0.0 releases for CLI, core analyzer, Vite plugin, and React overlay packages.

### Patch Changes

- Update published package documentation and unscoped package naming across the monorepo.
