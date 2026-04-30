# react-router-xray 🔬
> X-ray vision for your React Router app — CLI analysis, Vite plugin, live DOM overlay. Rust-powered.

[![npm version](https://img.shields.io/npm/v/react-router-xray.svg)](https://www.npmjs.com/package/react-router-xray)
[![CI](https://img.shields.io/github/actions/workflow/status/MhamedEl-shahawy/react-router-xray/ci.yml?branch=main)](https://github.com/MhamedEl-shahawy/react-router-xray/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/react-router-xray)](https://bundlephobia.com/package/react-router-xray)

## What It Does

The CLI ships as the `xray` binary and runs static route analysis against your router source before runtime. It computes route complexity, detects structural risks, and enforces configured rules in local workflows while CI enforcement support is in progress.

The Vite plugin executes the same analysis path at development startup and exposes results through a virtual module for in-app tooling and diagnostics. It keeps analysis data synchronized with source changes through HMR and provides route metadata to the browser layer without introducing separate parsing logic in JavaScript.

The React overlay renders as a floating `<RouteXrayOverlay />` panel and inspects matched route chains in real time while you navigate the app. It can highlight matched route DOM subtrees to make ownership and boundaries visible directly in the UI, using the Rust core compiled to WASM so browser and CLI behavior stay aligned.

This architecture is intended for teams that need route observability during development and deterministic policy checks in automation. The output surface differs across CLI, plugin, and overlay, but route parsing, matching, and issue semantics remain consistent because they execute shared core logic.

```text
┌─ react-router-xray ──────────────────────────────────────────┐
│  Routes: 14    Score: 72/100 ⚠    Errors: 1    Warnings: 2  │
└──────────────────────────────────────────────────────────────┘
/ (root layout)
├── /dashboard                      [lazy] [loader] ✓
├── /users/:userId                  [lazy] [loader] ⚠ no ErrorBoundary
└── /settings                       [lazy]          ✓

⛔ ERROR  /users/:userId  — Missing ErrorBoundary
⚠  WARN   /dashboard     — Deep nesting (depth: 5)
```

## Why This Exists

React Router applications need both static and runtime visibility when route trees grow and ownership crosses feature boundaries. Existing router tooling focuses on runtime inspection, but route policy enforcement, CI gates, and reproducible static analysis require a dedicated analysis path that does not depend on interactive sessions.

`react-router-xray` combines static analysis, live runtime overlay, and shared Rust logic so local debugging and CI decisions are based on the same engine. The table below positions `react-router-xray` relative to related tooling categories.

The comparison focuses on React Router workflows where route-file ownership, error boundaries, and nesting depth are part of code review criteria. In that workflow, runtime-only tools provide visibility but cannot fail builds or generate repository-level route quality signals.

| Feature | react-router-xray | react-router-devtools | TanStack DevTools |
|---|---|---|---|
| RR v6 SPA support | Yes | Yes | No |
| CLI analysis | Yes | No | No |
| CI enforcement | Planned | No | No |
| DOM X-ray highlight | Yes | Limited | No |
| WASM core | Yes | No | No |
| HTML report | Yes | No | No |

## Installation

Install the CLI and Vite plugin packages as development dependencies in your application workspace.

Installation is scoped to development because the runtime overlay is intended for diagnostics and is stripped from production paths. The CLI can still be executed in CI containers or local scripts after standard dependency installation.

```bash
npm install -D react-router-xray react-router-xray-react vite-plugin-react-router-xray
```

Pre-built Rust binaries are published for Linux, macOS, and Windows, so a Rust toolchain is not required on consumer projects.

Package managers download the native executable for your platform during installation, and the JavaScript wrapper resolves that binary at runtime. This distribution model keeps startup and analysis performance native while preserving standard npm-based dependency workflows.

## CLI Quick Start

Use the CLI to inspect route structure, run policy checks, and generate reports from the same analyzer used by the plugin and overlay.

The `routes` command is useful for structural inspection, while `analyze` and `check` are geared toward governance and threshold enforcement in local pipelines. `report` generates a static artifact that can be shared with reviewers or archived as a build output.

```bash
xray routes                        # print route tree
xray analyze                       # full report
xray check --fail-on error         # CI-style policy check (local)
xray report --open                 # HTML report
```

Create an `xray.config.json` file at the project root to define rule levels and score thresholds for your repository.

```json
{
  "routerFile": "src/router.tsx",
  "rules": {
    "missingErrorBoundary": "error",
    "deepNesting": { "level": "warn", "maxDepth": 4 },
    "duplicatePath": "error"
  },
  "thresholds": { "maxComplexityScore": 60 }
}
```

Rule severities map directly to report output and process exit behavior, which allows the same configuration to support local advisory checks and strict script-based enforcement. Threshold values let teams define a bounded complexity budget and track route-tree growth against policy over time.

## Vite Plugin

Configure the plugin in your Vite config to run route analysis during development and build steps with optional failure control for CI-driven build pipelines.

During development startup, the plugin performs an initial analysis pass before exposing manifest data and instrumentation. During builds, `failOnBuild` can be used to keep analysis non-blocking for migration periods while still surfacing diagnostics.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import reactRouterXray from 'vite-plugin-react-router-xray'

export default defineConfig({
  plugins: [
    react(),
    reactRouterXray({
      routes: ["/", "/dashboard", "/settings"],
      failOnBuild: false
    })
  ]
})
```

Import the virtual manifest module from application code when you need direct access to route metadata or aggregate analysis values.

```ts
import manifest from 'virtual:react-router-xray/manifest'
// manifest.routes → FlatRoute[]
// manifest.analysis → { score, issueCount }
```

The manifest payload is designed for dev-only diagnostics, custom debug panels, and editor-integrated tooling. Because it is emitted by the plugin from analyzer output, consuming applications do not need to implement route graph extraction logic in userland code.

Route entries in the manifest are flat and serialized for deterministic consumption by browser tooling. Analysis metadata is intentionally compact so HMR updates can refresh overlay state without excessive payload churn.

## React Overlay

Mount the overlay adjacent to your router provider so it can observe route matches, params, and loader state without changing your route definitions. The overlay is removed in production builds automatically and can be toggled during development with `Alt+R`.

```tsx
import { RouterProvider } from 'react-router-dom'
import { RouteXrayOverlay } from 'react-router-xray-react'

<RouterProvider router={router} />
<RouteXrayOverlay />   // toggle with Alt+R
```

When a route row is selected or hovered, the overlay resolves the corresponding instrumented boundary and applies a visual marker to the matched subtree. This interaction makes nested layout boundaries and outlet ownership visible in complex route hierarchies.

Loader and navigation state are projected into the panel so route matching and data lifecycle can be inspected together. This is useful when diagnosing latency sources in nested loaders or mismatch between route params and rendered content.

```text
┌─ RouteXrayOverlay ───────────────────────────────────────────┐
│ Matched chain                                                │
│ /  →  /users  →  /users/:userId                             │
│                                                              │
│ Params                                                       │
│ userId: "42"                                                 │
│                                                              │
│ Loader status                                                │
│ root: done   users: done   user-details: pending            │
│                                                              │
│ Hover route row → highlight DOM subtree in viewport         │
└──────────────────────────────────────────────────────────────┘
```

## Architecture

```text
Source (.tsx) → Rust Core (SWC parser → analyzer → matchit)
                     ├── native binary  →  CLI / CI
                     └── WASM module    →  Vite Plugin + React Overlay
```

SWC parses route-related AST structures and normalizes router definitions for the analysis pipeline. `matchit` performs radix-tree path matching for runtime and static route path logic, so CLI and browser diagnostics are computed from the same core behavior.

The analyzer stage computes route-level metrics and rule evaluations that are serialized for both terminal and browser consumers. Native and WASM targets are built from the same Rust crate so parity is maintained without duplicating algorithmic logic across languages.

Path normalization, parameter extraction, and match ranking are resolved consistently in both targets. That consistency reduces false positives caused by divergent parser implementations and keeps route issues reproducible between local and CI environments.

## CI Integration (Planned)

Native CI mode and the packaged GitHub Action are not yet released, but the target integration is a workflow step that executes route checks as a blocking signal with a minimum quality score.

In monorepos, this planned check will run per package by passing package-specific router entry files through config overrides. Repositories with multiple apps will be able to enforce independent thresholds while still using the same action interface.

```yaml
- uses: MhamedEl-shahawy/react-router-xray@v1
  with:
    fail-on: error
    min-score: 80
```

When released, failures will post a pull request comment containing an issues table so reviewers can see route-level diagnostics without pulling logs from the workflow run.

This integration pattern allows route regressions to be discussed in the pull request context with direct links to failing paths and rule categories. Teams can increment minimum score values gradually as route hygiene improves and historical debt is reduced.

## Contributing

Run Rust and JavaScript test suites together before submitting changes to keep the shared core and package integrations in sync.

Contributors changing CLI output formats should also validate snapshot or fixture expectations used by report generation. Contributors modifying overlay rendering should verify keyboard toggles and DOM highlight behavior in the demo integration.

```bash
cargo test && pnpm test
pnpm --filter demo dev
```

Analyzer rules are implemented in `packages/core/src/analyzer/mod.rs`, and overlay interface work is located in `packages/react/src/`.

Changes that affect route parsing or scoring should include test coverage in Rust and package-level verification in the JavaScript workspace. Integration updates should be validated against the demo app to confirm plugin manifest output and overlay behavior remain synchronized.

## License

MIT.
