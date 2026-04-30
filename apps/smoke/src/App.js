import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createBrowserRouter, Link, Outlet, RouterProvider } from "react-router-dom";
import { RouteXrayOverlay, XrayBoundary } from "react-router-xray-react";
function Shell() {
    return (_jsxs(XrayBoundary, { routeId: "layout", children: [_jsxs("div", { style: { padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 560 }, children: [_jsx("p", { style: { marginTop: 0 }, children: "Smoke app for react-router-xray-react. The overlay starts closed (FAB bottom-right). Use Alt+R or Ctrl+Shift+X to toggle. Click anywhere on this page when the panel is closed \u2014 the full-screen layer uses pointer-events passthrough so clicks reach here." }), _jsxs("nav", { style: { display: "flex", gap: 16, marginBottom: 24 }, children: [_jsx(Link, { to: "/", children: "Home" }), _jsx(Link, { to: "/about", children: "About" }), _jsx(Link, { to: "/slow", children: "Slow" })] }), _jsx(Outlet, {})] }), _jsx(RouteXrayOverlay, {})] }));
}
const router = createBrowserRouter([
    {
        id: "layout",
        path: "/",
        element: _jsx(Shell, {}),
        handle: {
            xray: { component: "Shell", errorBoundary: true }
        },
        children: [
            {
                index: true,
                element: _jsx(Home, {}),
                handle: { xray: { component: "Home" } }
            },
            {
                path: "about",
                element: _jsx(About, {}),
                handle: { xray: { component: "About" } }
            },
            {
                path: "slow",
                element: _jsx(Slow, {}),
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
    return (_jsxs(XrayBoundary, { routeId: "home", children: [_jsx("h1", { children: "Home" }), _jsx("button", { type: "button", children: "Focus test button" })] }));
}
function About() {
    return (_jsx(XrayBoundary, { routeId: "about", children: _jsx("h1", { children: "About" }) }));
}
function Slow() {
    return (_jsxs(XrayBoundary, { routeId: "slow", children: [_jsx("h1", { children: "Slow route" }), _jsx("p", { children: "Demo loader delay." })] }));
}
export function App() {
    return _jsx(RouterProvider, { router: router });
}
