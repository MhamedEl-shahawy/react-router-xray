import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, Outlet, Route, Routes } from "react-router-dom";
import { RouteXrayOverlay } from "react-router-xray-react";
function Shell() {
    return (_jsxs("div", { style: { borderBottom: "1px solid #e2e8f0", paddingBottom: 16, marginBottom: 16 }, children: [_jsxs("p", { style: { margin: "0 0 12px", fontSize: 13, color: "#475569", maxWidth: 720 }, children: ["Use Route X-Ray (corner button or Alt+R). Each destination uses a different pathname shape so", " ", _jsx("strong", { children: "structural clarity" }), " moves between minimal and heavy."] }), _jsxs("nav", { style: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }, children: [_jsx(Link, { to: "/", children: "Home \u00B7 minimal" }), _jsx("span", { style: { color: "#cbd5e1" }, children: "|" }), _jsx(Link, { to: "/slow", children: "Slow \u00B7 shallow chain" }), _jsx("span", { style: { color: "#cbd5e1" }, children: "|" }), _jsx(Link, { to: "/app/inbox", children: "App inbox \u00B7 moderate depth" }), _jsx("span", { style: { color: "#cbd5e1" }, children: "|" }), _jsx(Link, { to: "/deep/l1/l2/l3/l4", children: "Deep URL \u00B7 depth penalty" }), _jsx("span", { style: { color: "#cbd5e1" }, children: "|" }), _jsx(Link, { to: "/nest/two/three/leaf", children: "Nested layouts \u00B7 chain penalty" }), _jsx("span", { style: { color: "#cbd5e1" }, children: "|" }), _jsx(Link, { to: "/wild/files/docs/readme", children: "Wildcard segment" })] }), _jsx(Outlet, {})] }));
}
function NestChrome({ label }) {
    return (_jsxs("div", { style: { marginTop: 12, paddingLeft: 14, borderLeft: "3px solid #94a3b8" }, children: [_jsx("div", { style: { fontSize: 11, color: "#64748b", letterSpacing: "0.04em", marginBottom: 8 }, children: label }), _jsx(Outlet, {})] }));
}
function Page({ title, hint }) {
    return (_jsxs("article", { style: { marginTop: 20 }, children: [_jsx("h2", { style: { margin: "0 0 8px" }, children: title }), hint ? _jsx("p", { style: { margin: 0, color: "#64748b", fontSize: 14, maxWidth: 640 }, children: hint }) : null] }));
}
const xh = (component, extras) => ({
    handle: {
        xray: {
            component,
            lazy: extras?.lazy ?? false,
            errorBoundary: extras?.errorBoundary ?? false,
        },
    },
});
export default function App() {
    return (_jsxs("main", { style: { fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 900 }, children: [_jsx("h1", { style: { marginTop: 0 }, children: "React Router X-Ray demo" }), _jsx(Routes, { children: _jsxs(Route, { path: "/", element: _jsx(Shell, {}), children: [_jsx(Route, { index: true, element: _jsx(Page, { title: "Home", hint: "Usually the highest clarity: short matched chain and shallow pathnames." }), ...xh("HomePage") }), _jsx(Route, { path: "slow", element: _jsx(Page, { title: "Slow route", hint: "Two pathname rows (shell + leaf). Still a strong score\u2014compare with nested and deep URLs." }), ...xh("SlowRoute") }), _jsx(Route, { path: "app/inbox", element: _jsx(Page, { title: "App inbox", hint: "/app/inbox adds segment depth; clarity should sit in the moderate band." }), ...xh("AppInbox", { lazy: true }) }), _jsx(Route, { path: "deep/l1/l2/l3/l4", element: _jsx(Page, { title: "Deep flat URL", hint: "Single route definition but many segments\u2014depth penalties dominate." }), ...xh("DeepFlat") }), _jsx(Route, { path: "nest", element: _jsx(NestChrome, { label: "Nest \u00B7 layout row 1" }), ...xh("NestL1"), children: _jsx(Route, { path: "two", element: _jsx(NestChrome, { label: "Nest \u00B7 layout row 2" }), ...xh("NestL2"), children: _jsx(Route, { path: "three", element: _jsx(NestChrome, { label: "Nest \u00B7 layout row 3" }), ...xh("NestL3"), children: _jsx(Route, { path: "leaf", element: _jsx(Page, { title: "Nested chain leaf", hint: "Several layout matches for one URL\u2014matched-chain penalty stacks." }), ...xh("NestLeaf", { lazy: true, errorBoundary: true }) }) }) }) }), _jsx(Route, { path: "wild/*", element: _jsx(Page, { title: "Wildcard route", hint: "Splats can surface '*' markers in patterns depending on the router match\u2014compare penalties in X-Ray." }), ...xh("WildcardCatch") })] }) }), _jsx(RouteXrayOverlay, {})] }));
}
