import {
  createBrowserRouter,
  Link,
  Outlet,
  RouterProvider
} from "react-router-dom";
import { RouteXrayOverlay, XrayBoundary } from "react-router-xray-react";

function Shell() {
  return (
    <XrayBoundary routeId="layout">
      <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 560 }}>
        <p style={{ marginTop: 0 }}>
          Smoke app for react-router-xray-react. The overlay starts closed (FAB bottom-right).
          Use Alt+R or Ctrl+Shift+X to toggle. Click anywhere on this page when the panel is
          closed — the full-screen layer uses pointer-events passthrough so clicks reach here.
        </p>
        <nav style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
          <Link to="/slow">Slow</Link>
        </nav>
        <Outlet />
      </div>
      <RouteXrayOverlay />
    </XrayBoundary>
  );
}

const router = createBrowserRouter([
  {
    id: "layout",
    path: "/",
    element: <Shell />,
    handle: {
      xray: { component: "Shell", errorBoundary: true }
    },
    children: [
      {
        index: true,
        element: <Home />,
        handle: { xray: { component: "Home" } }
      },
      {
        path: "about",
        element: <About />,
        handle: { xray: { component: "About" } }
      },
      {
        path: "slow",
        element: <Slow />,
        loader: async () => {
          await new Promise((r) => setTimeout(r, 120));
          return { ok: true };
        },
        handle: { xray: { component: "Slow", lazy: false } }
      }
    ]
  }
]);

function Home() {
  return (
    <XrayBoundary routeId="home">
      <h1>Home</h1>
      <button type="button">Focus test button</button>
    </XrayBoundary>
  );
}

function About() {
  return (
    <XrayBoundary routeId="about">
      <h1>About</h1>
    </XrayBoundary>
  );
}

function Slow() {
  return (
    <XrayBoundary routeId="slow">
      <h1>Slow route</h1>
      <p>Demo loader delay.</p>
    </XrayBoundary>
  );
}

export function App() {
  return <RouterProvider router={router} />;
}
