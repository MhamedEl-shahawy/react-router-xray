import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Component, Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useMatches } from "react-router-dom";
const XRAY_PANEL_TITLE_ID = "route-xray-panel-title";
let styleInjected = false;
const XRAY_STYLE_ID = "route-xray-style";
let wasmModuleCache = null;
let wasmInitPromise = null;
async function loadWasmModule() {
    wasmModuleCache ??= await import("react-router-xray-core/wasm");
    return wasmModuleCache;
}
/** Loads WASM chunk lazily and initializes once; resets init promise on failure so callers can retry. */
async function ensureWasm() {
    const mod = await loadWasmModule();
    wasmInitPromise ??= mod.init().catch((error) => {
        wasmInitPromise = null;
        throw error;
    });
    await wasmInitPromise;
    return mod;
}
function injectStyles() {
    if (styleInjected || typeof document === "undefined")
        return;
    if (document.getElementById(XRAY_STYLE_ID)) {
        styleInjected = true;
        return;
    }
    const style = document.createElement("style");
    style.id = XRAY_STYLE_ID;
    style.textContent = `
  .xray-launcher{position:fixed;right:16px;bottom:16px;z-index:2147483646;border:1px solid #334155;background:#0f172a;color:#e2e8f0;border-radius:9999px;padding:8px 12px;font:12px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 12px 32px rgba(0,0,0,.4);pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
  .xray-launcher:focus-visible{outline:2px solid #93c5fd;outline-offset:3px}
  .xray-panel{position:fixed;right:16px;bottom:16px;width:380px;max-width:calc(100vw - 24px);max-height:calc(100vh - 32px);overflow:auto;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:12px;font:12px/1.4 system-ui,sans-serif;z-index:2147483646;box-shadow:0 12px 32px rgba(0,0,0,.4);pointer-events:auto;touch-action:manipulation;contain:content}
  .xray-panel:focus-within{outline:none}
  .xray-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #1e293b;font-weight:700;position:sticky;top:0;background:#0f172a;z-index:1}
  .xray-controls button{background:transparent;border:0;color:#e2e8f0;cursor:pointer;padding:0 6px;touch-action:manipulation;border-radius:6px}
  .xray-controls button:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}
  .xray-section{padding:8px 12px;border-bottom:1px solid #1e293b}
  .xray-title{font-size:10px;color:#94a3b8;letter-spacing:.08em;margin-bottom:4px}
  .xray-route-row{display:flex;justify-content:space-between;gap:8px;padding:2px 4px;border-radius:6px;cursor:pointer;touch-action:manipulation}
  .xray-route-row:focus-visible{outline:2px solid #93c5fd;outline-offset:1px}
  .xray-route-row:hover{background:#1e293b}
  .xray-badge{display:inline-block;padding:0 4px;border-radius:4px;border:1px solid #475569;font-size:10px;margin-left:4px}
  .xray-status{display:flex;justify-content:space-between}
  .xray-error{background:#450a0a;color:#fecaca;padding:8px 12px;font-size:11px;border-bottom:1px solid #7f1d1d}
  .xray-legend summary{cursor:pointer;font-size:10px;color:#94a3b8;letter-spacing:.08em;list-style:none}
  .xray-legend summary::-webkit-details-marker{display:none}
  .xray-legend-body{padding-top:6px;color:#cbd5e1;font-size:11px;line-height:1.45}
  .xray-legend-body p{margin:0 0 8px}
  .xray-code{font-family:ui-monospace,monospace;font-size:10px;color:#e2e8f0}
  .xray-metrics{font-size:10px;color:#94a3b8;line-height:1.35;margin-top:4px}
  .xray-insight{padding:4px 0;border-bottom:1px solid #1e293b;color:#e2e8f0;font-size:11px;line-height:1.35}
  .xray-insight:last-child{border-bottom:none}
  [data-xray-hovered="true"]{outline:2px solid #6366f1;position:relative}
  [data-xray-hovered="true"]::before{content:attr(data-xray-label);position:absolute;top:-24px;left:0;background:#312e81;color:#fff;border-radius:6px;padding:2px 6px;font-size:11px;white-space:nowrap;z-index:2147483647}
  `;
    document.head.appendChild(style);
    styleInjected = true;
}
function renderInBody(node) {
    if (typeof document === "undefined")
        return null;
    return createPortal(node, document.body);
}
function useLocalOpenState(initialOpen = false) {
    const [isOpen, setIsOpen] = useState(initialOpen);
    const toggle = () => setIsOpen((current) => !current);
    return { isOpen, setIsOpen, toggle };
}
function fallbackMatch(pathname) {
    return {
        id: pathname || "/",
        pathname: pathname || "/",
        params: {},
        handle: {}
    };
}
/** Stable match list for data routers (reference stable while route unchanged). */
function useStableDataOverlayMatches() {
    const pathname = useLocation().pathname || "/";
    const rawMatches = useMatches();
    return useMemo(() => {
        if (!rawMatches.length)
            return [fallbackMatch(pathname)];
        return rawMatches.map((match) => ({
            id: String(match.id ?? match.pathname ?? pathname),
            pathname: match.pathname || pathname,
            params: (match.params ?? {}),
            handle: match.handle
        }));
    }, [pathname, rawMatches]);
}
/** BrowserRouter / non-data-router fallback (location only). */
function useStableLegacyOverlayMatches() {
    const pathname = useLocation().pathname || "/";
    return useMemo(() => [fallbackMatch(pathname)], [pathname]);
}
function scheduleIdle(fn) {
    if (typeof requestIdleCallback !== "undefined") {
        const id = requestIdleCallback(fn, { timeout: 600 });
        return { cancel: () => cancelIdleCallback(id) };
    }
    const id = window.setTimeout(fn, 0);
    return { cancel: () => window.clearTimeout(id) };
}
function analysisRouteKey(matches) {
    return matches.map((m) => `${m.id}:${(m.pathname || "/").trim()}`).join("\n");
}
export function useRouteXray(matches, enabled = true) {
    const [score, setScore] = useState(0);
    const [insights, setInsights] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const routeLines = useMemo(() => matches.map((match) => (match.pathname || "/").trim()).join("\n"), [matches]);
    useEffect(() => {
        injectStyles();
    }, []);
    useEffect(() => {
        if (!enabled)
            return;
        let cancelled = false;
        const { cancel } = scheduleIdle(() => {
            void (async () => {
                try {
                    const mod = await ensureWasm();
                    const result = await mod.analyzeRoutes(routeLines);
                    if (cancelled)
                        return;
                    setScore(Math.max(0, Math.min(100, Number(result.score) || 0)));
                    setInsights(Array.isArray(result.insights) ? result.insights : []);
                    setMetrics(result.metrics ?? null);
                }
                catch {
                    if (!cancelled) {
                        setScore(0);
                        setInsights([]);
                        setMetrics(null);
                    }
                }
            })();
        });
        return () => {
            cancelled = true;
            cancel();
        };
    }, [enabled, routeLines]);
    return { matches, score, insights, metrics };
}
export function XrayBoundary({ routeId, children }) {
    return (_jsx("div", { "data-xray-route-id": routeId, children: children }));
}
function eventTargetIsEditable(target) {
    if (!(target instanceof HTMLElement))
        return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT")
        return true;
    if (target.isContentEditable)
        return true;
    if (target.closest("[contenteditable=\"true\"]"))
        return true;
    if (target.closest("[role=\"textbox\"]"))
        return true;
    if (target.getAttribute("role") === "combobox")
        return true;
    return false;
}
function useKeyboardShortcuts(isOverlayActive, toggle, close) {
    useEffect(() => {
        const handler = (event) => {
            if (eventTargetIsEditable(event.target))
                return;
            if ((event.altKey && event.code === "KeyR") || (event.ctrlKey && event.shiftKey && event.code === "KeyX")) {
                event.preventDefault();
                toggle();
            }
            if (event.key === "Escape" && isOverlayActive) {
                close();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [toggle, close, isOverlayActive]);
}
function useHoverInstrumentation() {
    const safeSelector = (value) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const highlight = (routeId, label) => {
        const node = document.querySelector(`[data-xray-route-id="${safeSelector(routeId)}"]`);
        if (!node)
            return;
        node.setAttribute("data-xray-hovered", "true");
        node.setAttribute("data-xray-label", label);
    };
    const clear = (routeId) => {
        const node = document.querySelector(`[data-xray-route-id="${safeSelector(routeId)}"]`);
        if (!node)
            return;
        node.removeAttribute("data-xray-hovered");
        node.removeAttribute("data-xray-label");
    };
    return { highlight, clear };
}
function getMatchPath(match) {
    return match.pathname || "/";
}
class DataRouterErrorBoundary extends Component {
    constructor() {
        super(...arguments);
        this.state = { legacy: false };
    }
    static getDerivedStateFromError(error) {
        if (!(error instanceof Error))
            return null;
        const msg = error.message;
        if (!/useMatches/i.test(msg))
            return null;
        if (/data router|RouterProvider|useRoutes\b/i.test(msg))
            return { legacy: true };
        return null;
    }
    render() {
        if (this.state.legacy)
            return this.props.fallback;
        return this.props.children;
    }
}
function OverlayInner({ matches, defaultOpen = false, showLauncherWhenClosed = true }) {
    const matchesRef = useRef(matches);
    matchesRef.current = matches;
    const { isOpen, setIsOpen, toggle } = useLocalOpenState(defaultOpen);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [wasmError, setWasmError] = useState(null);
    const [score, setScore] = useState(0);
    const [insights, setInsights] = useState([]);
    const [analysisMetrics, setAnalysisMetrics] = useState(null);
    const [paramNames, setParamNames] = useState({});
    const { highlight, clear } = useHoverInstrumentation();
    const routeAnalysisKey = useMemo(() => analysisRouteKey(matches), [matches]);
    useKeyboardShortcuts(isOpen, toggle, () => setIsOpen(false));
    useEffect(() => {
        injectStyles();
    }, []);
    useEffect(() => {
        if (!isOpen || isCollapsed)
            return;
        let cancelled = false;
        const { cancel } = scheduleIdle(() => {
            void (async () => {
                try {
                    const mod = await ensureWasm();
                    if (cancelled)
                        return;
                    const currentMatches = matchesRef.current;
                    const routeLines = currentMatches.map((m) => (m.pathname || "/").trim()).join("\n");
                    const [result, parsedEntries] = await Promise.all([
                        mod.analyzeRoutes(routeLines),
                        Promise.all(currentMatches.map(async (match) => {
                            const parsed = await mod.parsePattern(getMatchPath(match));
                            return [match.id, parsed.dynamic_params];
                        }))
                    ]);
                    if (cancelled)
                        return;
                    setScore(Math.max(0, Math.min(100, Number(result.score) || 0)));
                    setInsights(Array.isArray(result.insights) ? result.insights : []);
                    setAnalysisMetrics(result.metrics ?? null);
                    setParamNames(Object.fromEntries(parsedEntries));
                    setWasmError(null);
                }
                catch (error) {
                    if (!cancelled) {
                        setParamNames({});
                        setScore(0);
                        setInsights([]);
                        setAnalysisMetrics(null);
                        setWasmError(error instanceof Error ? error.message : "Route X-Ray WASM failed to load or run.");
                    }
                }
            })();
        });
        return () => {
            cancelled = true;
            cancel();
        };
    }, [isCollapsed, isOpen, routeAnalysisKey]);
    useEffect(() => {
        if (!isOpen)
            setWasmError(null);
    }, [isOpen]);
    if (!isOpen && !showLauncherWhenClosed) {
        return null;
    }
    if (!isOpen) {
        const launcher = (_jsx("button", { type: "button", className: "xray-launcher", onClick: (e) => {
                e.stopPropagation();
                setIsOpen(true);
            }, "aria-label": "Open Route X-Ray diagnostics", "aria-expanded": false, "aria-haspopup": "true", "aria-controls": "route-xray-panel", children: "\uD83D\uDD2C X-Ray" }));
        return renderInBody(launcher);
    }
    const activeChain = matches.map((match) => getMatchPath(match)).join(" → ");
    const activeParams = matches[matches.length - 1]?.params ?? {};
    const panel = (_jsxs("aside", { id: "route-xray-panel", className: "xray-panel", "data-testid": "xray-overlay", role: "region", "aria-labelledby": XRAY_PANEL_TITLE_ID, children: [_jsxs("div", { className: "xray-head", children: [_jsx("span", { id: XRAY_PANEL_TITLE_ID, children: "\uD83D\uDD2C Route X-Ray" }), _jsxs("div", { className: "xray-controls", children: [_jsx("button", { type: "button", onClick: () => setIsCollapsed((current) => !current), "aria-label": isCollapsed ? "Expand panel" : "Minimize panel", children: isCollapsed ? "+" : "−" }), _jsx("button", { type: "button", onClick: () => setIsOpen(false), "aria-label": "Close panel", children: "\u2715" })] })] }), wasmError ? (_jsxs("div", { className: "xray-error", role: "alert", children: ["X-Ray error (app should stay usable): ", wasmError] })) : null, !isCollapsed ? (_jsxs(_Fragment, { children: [_jsxs("section", { className: "xray-section", children: [_jsx("div", { className: "xray-title", children: "ACTIVE CHAIN" }), _jsx("div", { children: activeChain || "/" })] }), _jsxs("section", { className: "xray-section", children: [_jsx("div", { className: "xray-title", children: "MATCHED ROUTES" }), matches.map((match) => {
                                const routeId = match.id || getMatchPath(match);
                                const path = getMatchPath(match);
                                const hasDynamic = Object.keys(match.params || {}).length > 0;
                                const paramsText = hasDynamic
                                    ? ` ▸ ${Object.values(match.params || {}).join(", ")}`
                                    : "";
                                const dynamicNames = (paramNames[match.id] ?? []).join(", ");
                                const routeData = (match.handle ?? {});
                                const lazy = routeData.xray?.lazy ?? false;
                                const hasBoundary = routeData.xray?.errorBoundary ?? false;
                                const component = routeData.xray?.component ?? "Unknown";
                                return (_jsxs("div", { role: "button", tabIndex: 0, className: "xray-route-row", "aria-label": `Inspect route ${path}`, onMouseEnter: () => highlight(routeId, path), onMouseLeave: () => clear(routeId), onFocus: () => highlight(routeId, path), onBlur: () => clear(routeId), onKeyDown: (e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            highlight(routeId, path);
                                        }
                                    }, children: [_jsxs("span", { children: ["\u25CF ", path, paramsText, dynamicNames ? ` (${dynamicNames})` : ""] }), _jsxs("span", { children: [component, lazy ? _jsx("span", { className: "xray-badge", children: "L" }) : null, hasBoundary ? _jsx("span", { className: "xray-badge", children: "\u2713" }) : null] })] }, routeId));
                            })] }), _jsxs("section", { className: "xray-section", children: [_jsx("div", { className: "xray-title", children: "PARAMS" }), Object.keys(activeParams).length === 0 ? (_jsx("div", { children: "None" })) : (_jsx("div", { children: Object.entries(activeParams).map(([key, value]) => (_jsxs(Fragment, { children: [key, " = \"", String(value), "\" "] }, key))) }))] }), _jsxs("section", { className: "xray-section xray-status", children: [_jsx("span", { children: "LOADER STATUS" }), _jsx("span", { children: "\u25CF idle" })] }), _jsx("section", { className: "xray-section xray-legend", children: _jsxs("details", { children: [_jsx("summary", { children: "How this SCORE works" }), _jsxs("div", { className: "xray-legend-body", children: [_jsxs("p", { children: ["The overlay sends your ", _jsx("strong", { children: "matched pathnames" }), " (one line per route in the active chain) to the same heuristic shape as the Rust CLI\u2014not your whole repo and not runtime FPS."] }), _jsx("p", { children: _jsx("strong", { className: "xray-code", children: "score = min(100, max(0, maxDepth\u00D73 + dynamicParams\u00D72 + wildcards\u00D74 + eagerPaths))" }) }), _jsxs("p", { children: [_jsx("strong", { children: "maxDepth" }), " is the deepest segment count among those lines; ", _jsx("strong", { children: "dynamicParams" }), " counts", _jsx("span", { className: "xray-code", children: " :segment " }), " tokens; ", _jsx("strong", { children: "wildcards" }), " counts ", _jsx("span", { className: "xray-code", children: "*" }), ";", " ", _jsx("strong", { children: "eagerPaths" }), " is how many lines were analyzed (lazy/error metadata is unknown here, so each line is treated like an eager route row\u2014same convention as the analyzer when lazy flags are missing)."] }), _jsx("p", { children: "Higher scores mean heavier URL structure on paper; pair with the CLI + full route tree for CI-grade findings." })] })] }) }), _jsxs("section", { className: "xray-section xray-status", children: [_jsxs("div", { children: [_jsx("span", { children: "SCORE" }), _jsx("div", { className: "xray-metrics", "aria-label": "Score inputs", children: analysisMetrics ? (_jsxs(_Fragment, { children: ["depth ", analysisMetrics.maxPathDepth, " \u00B7 :params ", analysisMetrics.dynamicParamsTotal, " \u00B7 *", " ", analysisMetrics.wildcardsTotal, " \u00B7 paths ", analysisMetrics.routePathsAnalyzed] })) : ("…") })] }), _jsxs("span", { children: [Math.round(score), "/100 ", score > 60 ? "⚠" : "✓"] })] }), insights.length > 0 ? (_jsxs("section", { className: "xray-section", children: [_jsx("div", { className: "xray-title", children: "INSIGHTS" }), insights.map((line, index) => (_jsx("div", { className: "xray-insight", children: line }, `${index}-${line.slice(0, 80)}`)))] })) : null] })) : null] }));
    return renderInBody(panel);
}
function RouteXrayDataOverlay(props) {
    const matches = useStableDataOverlayMatches();
    return _jsx(OverlayInner, { ...props, matches: matches });
}
function RouteXrayLegacyOverlay(props) {
    const matches = useStableLegacyOverlayMatches();
    return _jsx(OverlayInner, { ...props, matches: matches });
}
function RouteXrayOverlayDev(props = {}) {
    return (_jsx(DataRouterErrorBoundary, { fallback: _jsx(RouteXrayLegacyOverlay, { ...props }), children: _jsx(RouteXrayDataOverlay, { ...props }) }));
}
export const RouteXrayOverlay = process.env.NODE_ENV === "production"
    ? () => null
    : RouteXrayOverlayDev;
