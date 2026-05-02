# react-router-xray-react

## 2.0.9

### Patch Changes

- 3f2798c: Make the overlay non-blocking via a full-viewport pointer-events pass-through root and explicit hit targets. Lazy-init WASM only when analysis runs. Add optional `RouteXrayOverlay` props (`defaultOpen`, `showLauncherWhenClosed`). Remove stray compiled `src/index.js` that could shadow source in tooling.

  Defer Vite plugin startup analysis to a microtask and add `startupAnalysis: false` to skip it entirely.

## 2.0.8

### Patch Changes

- Improve overlay control reliability with a persistent launcher button after close and an additional keyboard toggle shortcut (Ctrl+Shift+X) alongside Alt+R.

## 2.0.7

### Patch Changes

- Limit overlay pointer-event capture to visible panel controls so it cannot block interactions across the page.

## 2.0.6

### Patch Changes

- Fix overlay controls so close and minimize actions behave reliably. Minimize now collapses and expands panel content, while close fully hides the overlay.

## 2.0.5

### Patch Changes

- Prevent RouteXrayOverlay from crashing in BrowserRouter apps by gracefully falling back when data-router hooks are unavailable.

## 2.0.4

### Patch Changes

- Move React and React Router DOM to peer dependencies to avoid duplicate runtime copies and invalid hook call errors in consumer apps.

## 2.0.3

### Patch Changes

- Updated dependencies
  - react-router-xray-core@2.0.2

## 2.0.2

### Patch Changes

- Fix React package entrypoint exports to resolve built files under dist/src for npm consumers.

## 2.0.1

### Patch Changes

- Updated dependencies
  - react-router-xray-core@2.0.1

## 2.0.0

### Major Changes

- Publish initial 1.0.0 releases for CLI, core analyzer, Vite plugin, and React overlay packages.
- Publish initial 1.0.0 releases for CLI, core analyzer, Vite plugin, and React overlay packages.

### Patch Changes

- Update published package documentation and unscoped package naming across the monorepo.
- Updated dependencies
- Updated dependencies
  - react-router-xray-core@2.0.0
