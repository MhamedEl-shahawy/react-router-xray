# react-router-xray-react

React overlay package for live route diagnostics and DOM highlighting.

## Install

```bash
npm install -D react-router-xray-react
```

## Usage

```tsx
import { RouterProvider } from "react-router-dom";
import { RouteXrayOverlay } from "react-router-xray-react";

<RouterProvider router={router} />
<RouteXrayOverlay />
```

The overlay renders only in development (it returns `null` in production builds). It starts closed so WASM is not loaded until you open it. Toggle with `Alt+R` or `Ctrl+Shift+X`. Optional props:

```tsx
<RouteXrayOverlay defaultOpen />
<RouteXrayOverlay showLauncherWhenClosed={false} />
```

The UI sits in a full-viewport root with `pointer-events: none`; only the launcher, panel chrome, and route rows capture clicks so the underlying app stays usable.

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
