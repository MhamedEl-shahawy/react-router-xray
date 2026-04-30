import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, Route, Routes } from "react-router-dom";
import { RouteXrayOverlay } from "@react-router-xray/react";
function Page({ title }) {
    return _jsx("h2", { children: title });
}
export default function App() {
    return (_jsxs("main", { style: { fontFamily: "sans-serif", padding: 20 }, children: [_jsx("h1", { children: "React Router Xray Demo" }), _jsxs("nav", { style: { display: "flex", gap: 8 }, children: [_jsx(Link, { to: "/", children: "Home" }), _jsx(Link, { to: "/dashboard", children: "Dashboard" }), _jsx(Link, { to: "/settings", children: "Settings" })] }), _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Page, { title: "Home" }) }), _jsx(Route, { path: "/dashboard", element: _jsx(Page, { title: "Dashboard" }) }), _jsx(Route, { path: "/settings", element: _jsx(Page, { title: "Settings" }) })] }), _jsx(RouteXrayOverlay, { input: "/\n/dashboard\n/settings" })] }));
}
