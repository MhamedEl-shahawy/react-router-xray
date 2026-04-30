# react-router-xray

Developer tooling for inspecting and analyzing React Router apps, built as a `pnpm` + Turborepo monorepo.

## What this project does

`react-router-xray` gives you:

- A Rust-powered analysis engine for route trees (`packages/core`)
- A CLI (`xray`) for CI and local route checks (`packages/cli`)
- A Vite plugin to instrument route components in dev (`packages/vite-plugin`)
- A React overlay DevTools panel shown inside your app (`packages/react`)
- A demo app showing end-to-end usage (`apps/demo`)

---

## Monorepo layout

- `packages/core`  
  Rust crate with feature-gated outputs:
  - `cli`: native `xray` binary
  - `wasm`: browser-side module for overlay/pattern parsing
  - `napi`: Node native addon for tooling

- `packages/cli` (`react-router-xray`)  
  NPM CLI package that exposes `xray` command and runs Rust binary builds.

- `packages/vite-plugin` (`vite-plugin-react-router-xray`)  
  Vite plugin that:
  - Runs startup route analysis
  - Exposes a virtual module
  - Applies Babel transform instrumentation (dev mode only)

- `packages/react` (`@react-router-xray/react`)  
  In-browser overlay + hooks:
  - `RouteXrayOverlay`
  - `XrayBoundary`
  - `useRouteXray`

- `apps/demo`  
  Vite + React Router v6 sample integration.

---

## How it works (end-to-end)

1. Vite plugin parses/knows route metadata and instruments route components.
2. Instrumented components are wrapped with `XrayBoundary` and tagged in DOM (`data-xray-route-id`).
3. React overlay reads runtime router context (`useMatches`, `useNavigation`, loader data).
4. Overlay calls core WASM helpers (`analyzeRoutes`, `parsePattern`) to compute score and route details.
5. CLI and CI reuse the same core engine to report issues and generate HTML reports.

This keeps runtime UI and CI checks aligned around one analysis core.

---

## Quick start

### 1) Install

```bash
pnpm install
```

### 2) Build all packages

```bash
pnpm build
```

### 3) Run demo

```bash
pnpm --filter @apps/demo dev
```

### 4) Run CLI analyze from demo

```bash
pnpm --filter @apps/demo analyze
```

---

## Common commands

- `pnpm build` - build all workspaces via Turbo
- `pnpm dev` - run dev tasks (parallel)
- `pnpm test` - run all tests
- `pnpm lint` - run lint tasks
- `pnpm analyze` - run demo analyze script

Package-local examples:

- `pnpm --filter react-router-xray test`
- `pnpm --filter vite-plugin-react-router-xray test`
- `pnpm --filter @react-router-xray/react test`

---

## CLI usage

Main command:

```bash
xray <command> [options]
```

Commands:

- `analyze` - full analysis and report output (terminal/json/html)
- `routes` - route tree/list/json output
- `check` - CI-focused issue output + exit status
- `report` - standalone interactive HTML report

Auto-detected router files:

- `src/router.tsx`
- `src/App.tsx`
- `app/router.ts`

Optional config:

- `xray.config.json`

---

## Dev overlay usage

In your app:

```tsx
import { RouteXrayOverlay } from "@react-router-xray/react";

export function App() {
  return (
    <>
      {/* your routes */}
      <RouteXrayOverlay />
    </>
  );
}
```

Keyboard:

- `Alt+R` toggle panel
- `Esc` close panel

Production guard is built-in: overlay renders `null` in production.

---

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

- Rust tests
- TypeScript/Turbo build
- CLI smoke test

---

## Notes

- Workspace uses `pnpm` + Turborepo for JS/TS orchestration.
- Rust workspace is rooted at `Cargo.toml` and currently includes `packages/core`.
- All report HTML output is self-contained (inline CSS/JS, no external CDN).
