# vite-plugin-react-router-xray

## 2.0.3

### Patch Changes

- 3f2798c: Make the overlay non-blocking via a full-viewport pointer-events pass-through root and explicit hit targets. Lazy-init WASM only when analysis runs. Add optional `RouteXrayOverlay` props (`defaultOpen`, `showLauncherWhenClosed`). Remove stray compiled `src/index.js` that could shadow source in tooling.

  Defer Vite plugin startup analysis to a microtask and add `startupAnalysis: false` to skip it entirely.

## 2.0.2

### Patch Changes

- Normalize Vite plugin route input from arrays and newline strings, refresh docs/examples to the tested options format, and improve CLI terminal report presentation.
- Updated dependencies
  - react-router-xray-core@2.0.2

## 2.0.1

### Patch Changes

- Updated dependencies
  - react-router-xray-core@2.0.1

## 2.0.0

### Major Changes

- Publish initial 1.0.0 releases for CLI, core analyzer, Vite plugin, and React overlay packages.

### Patch Changes

- Update published package documentation and unscoped package naming across the monorepo.
- Updated dependencies
- Updated dependencies
  - react-router-xray-core@2.0.0
