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

The overlay renders in development and can be toggled with `Alt+R`.

## Exports

- `RouteXrayOverlay`
- `XrayBoundary`
- `useRouteXray`

## License

MIT
