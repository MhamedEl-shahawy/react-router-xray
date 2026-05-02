# react-router-xray-react

React overlay package for live route diagnostics and DOM highlighting.

## Install

```bash
npm install -D react-router-xray-react react-dom
```

Requires **React 18+**, **React DOM 18+**, and **React Router DOM 6+** (same as typical Vite/React SPA setups).

## Usage

```tsx
import { RouterProvider } from "react-router-dom";
import { RouteXrayOverlay } from "react-router-xray-react";

<RouterProvider router={router} />
<RouteXrayOverlay />
```

The UI mounts into `document.body` via a React portal so it stays above transformed/`overflow` layouts and the FAB stays clickable. Toggle with `Alt+R` or `Ctrl+Shift+X`. Optional props:

```tsx
<RouteXrayOverlay defaultOpen />
<RouteXrayOverlay showLauncherWhenClosed={false} />
```

WASM loads only after you open the panel (dynamic import), so idle apps avoid that cost.

To keep devtools out of the main chunk until needed, lazy-load the package:

```tsx
import { lazy, Suspense } from "react";

const RouteXrayOverlay = lazy(() =>
  import("react-router-xray-react").then((m) => ({ default: m.RouteXrayOverlay }))
);

<Suspense fallback={null}>
  <RouteXrayOverlay />
</Suspense>
```

## Exports

- `RouteXrayOverlay`
- `XrayBoundary`
- `useRouteXray` — returns `{ matches, score, issues }` when `enabled` is true (WASM runs only while enabled)

## License

MIT
