import type { AnalysisMetrics } from "react-router-xray-core/wasm";
import {
  Component,
  Fragment,
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import {
  useLocation,
  useMatches
} from "react-router-dom";

type WasmApi = typeof import("react-router-xray-core/wasm");

type OverlayMatch = {
  id: string;
  pathname: string;
  params: Record<string, string>;
  handle?: unknown;
};

/** Clarity score + path-derived insights from `analyzeRoutes` (matches mirror router state). */
export type RouteXrayState = {
  matches: OverlayMatch[];
  /** 0–100 structural clarity for this navigation pathnames chain (higher = simpler path surface). */
  score: number;
  insights: string[];
  metrics: AnalysisMetrics | null;
};

export type RouteXrayOverlayProps = {
  /** When true, panel opens on mount (dev-only; avoid for perf). Default false. */
  defaultOpen?: boolean;
  /** Floating launcher when panel is closed. Default true. If false, use Alt+R / Ctrl+Shift+X only. */
  showLauncherWhenClosed?: boolean;
};

const XRAY_PANEL_TITLE_ID = "route-xray-panel-title";

let styleInjected = false;
const XRAY_STYLE_ID = "route-xray-style";

let wasmModuleCache: WasmApi | null = null;
let wasmInitPromise: Promise<void> | null = null;

async function loadWasmModule(): Promise<WasmApi> {
  wasmModuleCache ??= await import("react-router-xray-core/wasm");
  return wasmModuleCache;
}

/** Loads WASM chunk lazily and initializes once; resets init promise on failure so callers can retry. */
async function ensureWasm(): Promise<WasmApi> {
  const mod = await loadWasmModule();
  wasmInitPromise ??= mod.init().catch((error: unknown) => {
    wasmInitPromise = null;
    throw error;
  });
  await wasmInitPromise;
  return mod;
}

function injectStyles() {
  if (styleInjected || typeof document === "undefined") return;
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
  .xray-insight{padding:4px 0;border-bottom:1px solid #1e293b;color:#e2e8f0;font-size:11px;line-height:1.35}
  .xray-insight:last-child{border-bottom:none}
  .xray-clarity-hero{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:6px}
  .xray-clarity-scoreblock{display:flex;align-items:baseline;gap:4px}
  .xray-clarity-num{font-size:26px;font-weight:700;line-height:1;color:#f8fafc;letter-spacing:-0.02em}
  .xray-clarity-denom{font-size:12px;color:#94a3b8;font-weight:600}
  .xray-tier{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;border:1px solid transparent;white-space:nowrap;line-height:1.2}
  .xray-tier-minimal{border-color:#15803d;color:#bbf7d0;background:rgba(22,163,74,.18)}
  .xray-tier-moderate{border-color:#2563eb;color:#bfdbfe;background:rgba(37,99,235,.2)}
  .xray-tier-noticeable{border-color:#ca8a04;color:#fef08a;background:rgba(234,179,8,.18)}
  .xray-tier-heavy{border-color:#b91c1c;color:#fecaca;background:rgba(220,38,38,.18)}
  .xray-clarity-headline{margin:6px 0 4px;color:#e2e8f0;font-size:12px;line-height:1.45;font-weight:600}
  .xray-clarity-sub{margin:0 0 10px;color:#94a3b8;font-size:10px;line-height:1.45}
  .xray-clarity-loading{color:#94a3b8;font-size:11px}
  .xray-breakdown{width:100%;border-collapse:collapse;margin:8px 0 6px;font-size:11px}
  .xray-breakdown th{color:#94a3b8;text-align:left;font-weight:700;font-size:9px;letter-spacing:.08em;text-transform:uppercase;padding:4px 0;border-bottom:1px solid #334155}
  .xray-breakdown-ptshead{text-align:right}
  .xray-breakdown td{padding:6px 0;border-bottom:1px solid #1e293b;vertical-align:top}
  .xray-breakdown-label{font-weight:600;color:#e2e8f0}
  .xray-breakdown-detail{margin-top:3px;color:#94a3b8;font-size:10px;line-height:1.35}
  .xray-breakdown-pts{text-align:right;font-variant-numeric:tabular-nums;color:#fecaca;font-weight:600}
  .xray-breakdown-total td{padding-top:8px;border-bottom:none;color:#cbd5e1;font-weight:700}
  .xray-breakdown-total .xray-breakdown-pts{color:#fda4af}
  .xray-legend-nested{margin-top:8px}
  [data-xray-hovered="true"]{outline:2px solid #6366f1;position:relative}
  [data-xray-hovered="true"]::before{content:attr(data-xray-label);position:absolute;top:-24px;left:0;background:#312e81;color:#fff;border-radius:6px;padding:2px 6px;font-size:11px;white-space:nowrap;z-index:2147483647}
  `;
  document.head.appendChild(style);
  styleInjected = true;
}

function tierPresentation(tier: AnalysisMetrics["tier"]): { className: string; label: string } {
  switch (tier) {
    case "minimal":
      return { className: "xray-tier xray-tier-minimal", label: "Minimal load" };
    case "moderate":
      return { className: "xray-tier xray-tier-moderate", label: "Moderate load" };
    case "noticeable":
      return { className: "xray-tier xray-tier-noticeable", label: "Noticeable load" };
    default:
      return { className: "xray-tier xray-tier-heavy", label: "Heavy load" };
  }
}

function ClarityTierBadge({ tier }: { tier: AnalysisMetrics["tier"] }) {
  const { className, label } = tierPresentation(tier);
  return <span className={className}>{label}</span>;
}

function renderInBody(node: ReactNode) {
  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
}

function useLocalOpenState(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const toggle = () => setIsOpen((current) => !current);
  return { isOpen, setIsOpen, toggle };
}

function fallbackMatch(pathname: string): OverlayMatch {
  return {
    id: pathname || "/",
    pathname: pathname || "/",
    params: {},
    handle: {}
  };
}

/** Stable match list for data routers (reference stable while route unchanged). */
function useStableDataOverlayMatches(): OverlayMatch[] {
  const pathname = useLocation().pathname || "/";
  const rawMatches = useMatches();
  return useMemo(() => {
    if (!rawMatches.length) return [fallbackMatch(pathname)];
    return rawMatches.map((match) => ({
      id: String(match.id ?? match.pathname ?? pathname),
      pathname: match.pathname || pathname,
      params: (match.params ?? {}) as Record<string, string>,
      handle: match.handle
    }));
  }, [pathname, rawMatches]);
}

/** BrowserRouter / non-data-router fallback (location only). */
function useStableLegacyOverlayMatches(): OverlayMatch[] {
  const pathname = useLocation().pathname || "/";
  return useMemo(() => [fallbackMatch(pathname)], [pathname]);
}

function scheduleIdle(fn: () => void): { cancel: () => void } {
  if (typeof requestIdleCallback !== "undefined") {
    const id = requestIdleCallback(fn, { timeout: 600 });
    return { cancel: () => cancelIdleCallback(id) };
  }
  const id = window.setTimeout(fn, 0);
  return { cancel: () => window.clearTimeout(id) };
}

function analysisRouteKey(matches: OverlayMatch[]): string {
  return matches.map((m) => `${m.id}:${(m.pathname || "/").trim()}`).join("\n");
}

export function useRouteXray(matches: OverlayMatch[], enabled = true): RouteXrayState {
  const [score, setScore] = useState(0);
  const [insights, setInsights] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<AnalysisMetrics | null>(null);

  const routeLines = useMemo(
    () => matches.map((match) => (match.pathname || "/").trim()).join("\n"),
    [matches]
  );

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const { cancel } = scheduleIdle(() => {
      void (async () => {
        try {
          const mod = await ensureWasm();
          const result = await mod.analyzeRoutes(routeLines);
          if (cancelled) return;
          const clarity =
            Number(result.metrics?.clarityScore ?? result.score) || 0;
          setScore(Math.max(0, Math.min(100, clarity)));
          setInsights(Array.isArray(result.insights) ? result.insights : []);
          setMetrics(result.metrics ?? null);
        } catch {
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

export function XrayBoundary({ routeId, children }: PropsWithChildren<{ routeId: string }>) {
  return (
    <div data-xray-route-id={routeId}>
      {children}
    </div>
  );
}

function eventTargetIsEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  if (target.closest("[contenteditable=\"true\"]")) return true;
  if (target.closest("[role=\"textbox\"]")) return true;
  if (target.getAttribute("role") === "combobox") return true;
  return false;
}

function useKeyboardShortcuts(isOverlayActive: boolean, toggle: () => void, close: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (eventTargetIsEditable(event.target)) return;

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
  const safeSelector = (value: string) =>
    value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const highlight = (routeId: string, label: string) => {
    const node = document.querySelector(`[data-xray-route-id="${safeSelector(routeId)}"]`) as HTMLElement | null;
    if (!node) return;
    node.setAttribute("data-xray-hovered", "true");
    node.setAttribute("data-xray-label", label);
  };

  const clear = (routeId: string) => {
    const node = document.querySelector(`[data-xray-route-id="${safeSelector(routeId)}"]`) as HTMLElement | null;
    if (!node) return;
    node.removeAttribute("data-xray-hovered");
    node.removeAttribute("data-xray-label");
  };

  return { highlight, clear };
}

function getMatchPath(match: OverlayMatch): string {
  return match.pathname || "/";
}

type BoundaryProps = { children: ReactNode; fallback: ReactNode };
type BoundaryState = { legacy: boolean };

class DataRouterErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { legacy: false };

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> | null {
    if (!(error instanceof Error)) return null;
    const msg = error.message;
    if (!/useMatches/i.test(msg)) return null;
    if (/data router|RouterProvider|useRoutes\b/i.test(msg)) return { legacy: true };
    return null;
  }

  render() {
    if (this.state.legacy) return this.props.fallback;
    return this.props.children;
  }
}

function OverlayInner({
  matches,
  defaultOpen = false,
  showLauncherWhenClosed = true
}: RouteXrayOverlayProps & { matches: OverlayMatch[] }) {
  const matchesRef = useRef(matches);
  matchesRef.current = matches;

  const { isOpen, setIsOpen, toggle } = useLocalOpenState(defaultOpen);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [wasmError, setWasmError] = useState<string | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [analysisMetrics, setAnalysisMetrics] = useState<AnalysisMetrics | null>(null);
  const [paramNames, setParamNames] = useState<Record<string, string[]>>({});
  const { highlight, clear } = useHoverInstrumentation();

  const routeAnalysisKey = useMemo(() => analysisRouteKey(matches), [matches]);

  useKeyboardShortcuts(isOpen, toggle, () => setIsOpen(false));

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    if (!isOpen || isCollapsed) return;
    let cancelled = false;
    const { cancel } = scheduleIdle(() => {
      void (async () => {
        try {
          const mod = await ensureWasm();
          if (cancelled) return;
          const currentMatches = matchesRef.current;
          const routeLines = currentMatches.map((m) => (m.pathname || "/").trim()).join("\n");
          const [result, parsedEntries] = await Promise.all([
            mod.analyzeRoutes(routeLines),
            Promise.all(
              currentMatches.map(async (match) => {
                const parsed = await mod.parsePattern(getMatchPath(match));
                return [match.id, parsed.dynamic_params] as const;
              })
            )
          ]);
          if (cancelled) return;
          setInsights(Array.isArray(result.insights) ? result.insights : []);
          setAnalysisMetrics(result.metrics ?? null);
          setParamNames(Object.fromEntries(parsedEntries));
          setWasmError(null);
        } catch (error: unknown) {
          if (!cancelled) {
            setParamNames({});
            setInsights([]);
            setAnalysisMetrics(null);
            setWasmError(
              error instanceof Error ? error.message : "Route X-Ray WASM failed to load or run."
            );
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
    if (!isOpen) setWasmError(null);
  }, [isOpen]);

  if (!isOpen && !showLauncherWhenClosed) {
    return null;
  }

  if (!isOpen) {
    const launcher = (
      <button
        type="button"
        className="xray-launcher"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        aria-label="Open Route X-Ray diagnostics"
        aria-expanded={false}
        aria-haspopup="true"
        aria-controls="route-xray-panel"
      >
        🔬 X-Ray
      </button>
    );
    return renderInBody(launcher);
  }

  const activeChain = matches.map((match) => getMatchPath(match)).join(" → ");
  const activeParams = matches[matches.length - 1]?.params ?? {};

  const panel = (
    <aside
      id="route-xray-panel"
      className="xray-panel"
      data-testid="xray-overlay"
      role="region"
      aria-labelledby={XRAY_PANEL_TITLE_ID}
    >
      <div className="xray-head">
        <span id={XRAY_PANEL_TITLE_ID}>🔬 Route X-Ray</span>
        <div className="xray-controls">
          <button
            type="button"
            onClick={() => setIsCollapsed((current) => !current)}
            aria-label={isCollapsed ? "Expand panel" : "Minimize panel"}
          >
            {isCollapsed ? "+" : "−"}
          </button>
          <button type="button" onClick={() => setIsOpen(false)} aria-label="Close panel">✕</button>
        </div>
      </div>

      {wasmError ? (
        <div className="xray-error" role="alert">
          X-Ray error (app should stay usable): {wasmError}
        </div>
      ) : null}

      {!isCollapsed ? (
        <>
          <section className="xray-section">
            <div className="xray-title">ACTIVE CHAIN</div>
            <div>{activeChain || "/"}</div>
          </section>

          <section className="xray-section">
            <div className="xray-title">MATCHED ROUTES</div>
            {matches.map((match) => {
              const routeId = match.id || getMatchPath(match);
              const path = getMatchPath(match);
              const hasDynamic = Object.keys(match.params || {}).length > 0;
              const paramsText = hasDynamic
                ? ` ▸ ${Object.values(match.params || {}).join(", ")}`
                : "";
              const dynamicNames = (paramNames[match.id] ?? []).join(", ");
              const routeData = (match.handle ?? {}) as {
                xray?: { lazy?: boolean; errorBoundary?: boolean; component?: string };
              };
              const lazy = routeData.xray?.lazy ?? false;
              const hasBoundary = routeData.xray?.errorBoundary ?? false;
              const component = routeData.xray?.component ?? "Unknown";

              return (
                <div
                  key={routeId}
                  role="button"
                  tabIndex={0}
                  className="xray-route-row"
                  aria-label={`Inspect route ${path}`}
                  onMouseEnter={() => highlight(routeId, path)}
                  onMouseLeave={() => clear(routeId)}
                  onFocus={() => highlight(routeId, path)}
                  onBlur={() => clear(routeId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      highlight(routeId, path);
                    }
                  }}
                >
                  <span>● {path}{paramsText}{dynamicNames ? ` (${dynamicNames})` : ""}</span>
                  <span>
                    {component}
                    {lazy ? <span className="xray-badge">L</span> : null}
                    {hasBoundary ? <span className="xray-badge">✓</span> : null}
                  </span>
                </div>
              );
            })}
          </section>

          <section className="xray-section">
            <div className="xray-title">STRUCTURAL CLARITY</div>
            <div className="xray-clarity-card">
              {analysisMetrics ? (
                <>
                  <div className="xray-clarity-hero">
                    <div className="xray-clarity-scoreblock" aria-label="Structural clarity score">
                      <span className="xray-clarity-num">{Math.round(analysisMetrics.clarityScore)}</span>
                      <span className="xray-clarity-denom">/ 100</span>
                    </div>
                    <ClarityTierBadge tier={analysisMetrics.tier} />
                  </div>
                  <p className="xray-clarity-headline">{analysisMetrics.headline}</p>
                  <p className="xray-clarity-sub">
                    pathname-only heuristic for this matched chain—higher means fewer structural penalties from nesting,
                    breadth, <span className="xray-code">:params</span>, and <span className="xray-code">*</span>. Not
                    Lighthouse, FPS, or bundle size.
                  </p>
                  {analysisMetrics.routePathsAnalyzed > 0 ? (
                    <table className="xray-breakdown">
                      <thead>
                        <tr>
                          <th scope="col">What changed the score</th>
                          <th scope="col" className="xray-breakdown-ptshead">
                            Points off
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysisMetrics.contributors.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <div className="xray-breakdown-label">{c.label}</div>
                              <div className="xray-breakdown-detail">{c.detail}</div>
                            </td>
                            <td className="xray-breakdown-pts">{c.penaltyPoints}</td>
                          </tr>
                        ))}
                        <tr className="xray-breakdown-total">
                          <td>Total penalty (capped)</td>
                          <td className="xray-breakdown-pts">{analysisMetrics.structuralPenalty}</td>
                        </tr>
                      </tbody>
                    </table>
                  ) : null}
                  <details className="xray-legend xray-legend-nested">
                    <summary>How this score is calculated</summary>
                    <div className="xray-legend-body">
                      <p>
                        Start from <strong>100</strong>. Each factor below adds penalty points; we cap total penalty so the
                        score stays meaningful on extreme URLs.
                      </p>
                      <p>
                        <strong>Matched chain:</strong> +5 for each pathname row after the first (more layouts in this chain).
                      </p>
                      <p>
                        <strong>URL depth:</strong> +10 for each segment beyond depth 1 on the deepest pathname row.
                      </p>
                      <p>
                        <strong>Dynamic segments:</strong> +8 each (<span className="xray-code">:id</span>-style tokens).
                      </p>
                      <p>
                        <strong>Wildcards:</strong> +15 each (<span className="xray-code">*</span>).
                      </p>
                      <p>
                        The Rust CLI scores your full route manifest (patterns, lazy flags, etc.)—expect different numbers
                        there; use both together when tuning CI.
                      </p>
                    </div>
                  </details>
                </>
              ) : (
                <div className="xray-clarity-loading">Computing structural clarity…</div>
              )}
            </div>
          </section>

          <section className="xray-section">
            <div className="xray-title">PARAMS</div>
            {Object.keys(activeParams).length === 0 ? (
              <div>None</div>
            ) : (
              <div>
                {Object.entries(activeParams).map(([key, value]) => (
                  <Fragment key={key}>{key} = "{String(value)}" </Fragment>
                ))}
              </div>
            )}
          </section>

          <section className="xray-section xray-status">
            <span>LOADER STATUS</span>
            <span>● idle</span>
          </section>

          {insights.length > 0 ? (
            <section className="xray-section">
              <div className="xray-title">INSIGHTS</div>
              {insights.map((line, index) => (
                <div key={`${index}-${line.slice(0, 80)}`} className="xray-insight">
                  {line}
                </div>
              ))}
            </section>
          ) : null}
        </>
      ) : null}
    </aside>
  );

  return renderInBody(panel);
}

function RouteXrayDataOverlay(props: RouteXrayOverlayProps) {
  const matches = useStableDataOverlayMatches();
  return <OverlayInner {...props} matches={matches} />;
}

function RouteXrayLegacyOverlay(props: RouteXrayOverlayProps) {
  const matches = useStableLegacyOverlayMatches();
  return <OverlayInner {...props} matches={matches} />;
}

function RouteXrayOverlayDev(props: RouteXrayOverlayProps = {}) {
  return (
    <DataRouterErrorBoundary fallback={<RouteXrayLegacyOverlay {...props} />}>
      <RouteXrayDataOverlay {...props} />
    </DataRouterErrorBoundary>
  );
}

export const RouteXrayOverlay =
  process.env.NODE_ENV === "production"
    ? () => null
    : RouteXrayOverlayDev;
