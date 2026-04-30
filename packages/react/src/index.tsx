import {
  Fragment,
  type PropsWithChildren,
  useEffect,
  useState
} from "react";
import {
  useLocation,
  useMatches
} from "react-router-dom";
import * as wasm from "react-router-xray-core/wasm";

type OverlayMatch = {
  id: string;
  pathname: string;
  params: Record<string, string>;
  handle?: unknown;
};

/** Score/issues from WASM analysis (matches mirror router state). */
export type RouteXrayState = {
  matches: OverlayMatch[];
  score: number;
  issues: string[];
};

export type RouteXrayOverlayProps = {
  /** When true, panel opens on mount (dev-only; avoid for perf). Default false. */
  defaultOpen?: boolean;
  /** Floating launcher when panel is closed. Default true. If false, use Alt+R / Ctrl+Shift+X only. */
  showLauncherWhenClosed?: boolean;
};

let styleInjected = false;
const XRAY_STYLE_ID = "route-xray-style";

let wasmInitPromise: Promise<void> | null = null;

async function ensureWasm(): Promise<void> {
  wasmInitPromise ??= wasm.init();
  await wasmInitPromise;
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
  .xray-root{position:fixed;inset:0;z-index:2147483647;pointer-events:none}
  .xray-hit{pointer-events:auto}
  .xray-panel{position:absolute;right:16px;bottom:16px;width:380px;max-width:calc(100vw - 24px);background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:12px;font:12px/1.4 system-ui,sans-serif;box-shadow:0 12px 32px rgba(0,0,0,.4);pointer-events:none}
  .xray-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #1e293b;font-weight:700}
  .xray-controls button{background:transparent;border:0;color:#e2e8f0;cursor:pointer;padding:0 6px}
  .xray-section{padding:8px 12px;border-bottom:1px solid #1e293b}
  .xray-title{font-size:10px;color:#94a3b8;letter-spacing:.08em;margin-bottom:4px}
  .xray-route-row{display:flex;justify-content:space-between;gap:8px;padding:2px 4px;border-radius:6px;cursor:pointer}
  .xray-route-row:hover{background:#1e293b}
  .xray-badge{display:inline-block;padding:0 4px;border-radius:4px;border:1px solid #475569;font-size:10px;margin-left:4px}
  .xray-status{display:flex;justify-content:space-between}
  [data-xray-hovered="true"]{outline:2px solid #6366f1;position:relative}
  [data-xray-hovered="true"]::before{content:attr(data-xray-label);position:absolute;top:-24px;left:0;background:#312e81;color:#fff;border-radius:6px;padding:2px 6px;font-size:11px;white-space:nowrap;z-index:2147483647}
  .xray-launcher{position:absolute;right:16px;bottom:16px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;border-radius:9999px;padding:8px 10px;font:12px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 12px 32px rgba(0,0,0,.4)}
  `;
  document.head.appendChild(style);
  styleInjected = true;
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

function useOverlayMatches(): OverlayMatch[] {
  let pathname = "/";
  try {
    const location = useLocation();
    pathname = location.pathname || "/";
  } catch {
    pathname = "/";
  }

  try {
    const matches = useMatches();
    if (!matches.length) return [fallbackMatch(pathname)];
    return matches.map((match) => ({
      id: String(match.id ?? match.pathname ?? pathname),
      pathname: match.pathname || pathname,
      params: (match.params ?? {}) as Record<string, string>,
      handle: match.handle
    }));
  } catch {
    return [fallbackMatch(pathname)];
  }
}

export function useRouteXray(matches: OverlayMatch[], enabled = true): RouteXrayState {
  const [score, setScore] = useState(0);
  const [issues, setIssues] = useState<string[]>([]);

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const routeLines = matches.map((match) => (match.pathname || "/").trim()).join("\n");
    (async () => {
      try {
        await ensureWasm();
        const result = await wasm.analyzeRoutes(routeLines);
        if (cancelled) return;
        setScore(Math.max(0, Math.min(100, Number(result.score) || 0)));
        setIssues(
          result.score > 70
            ? ["Complexity above recommended threshold"]
            : []
        );
      } catch {
        if (!cancelled) {
          setScore(0);
          setIssues([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, matches]);

  return { matches, score, issues };
}

export function XrayBoundary({ routeId, children }: PropsWithChildren<{ routeId: string }>) {
  return (
    <div data-xray-route-id={routeId}>
      {children}
    </div>
  );
}

function useKeyboardShortcuts(toggle: () => void, close: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.altKey && event.code === "KeyR") || (event.ctrlKey && event.shiftKey && event.code === "KeyX")) {
        event.preventDefault();
        toggle();
      }
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle, close]);
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

export const RouteXrayOverlay =
  process.env.NODE_ENV === "production"
    ? () => null
    : function RouteXrayOverlayImpl({
      defaultOpen = false,
      showLauncherWhenClosed = true
    }: RouteXrayOverlayProps = {}) {
      const matches = useOverlayMatches();
      const { isOpen, setIsOpen, toggle } = useLocalOpenState(defaultOpen);
      const [isCollapsed, setIsCollapsed] = useState(false);
      const { score, issues } = useRouteXray(matches, isOpen && !isCollapsed);
      const [paramNames, setParamNames] = useState<Record<string, string[]>>({});
      const { highlight, clear } = useHoverInstrumentation();

      useKeyboardShortcuts(toggle, () => setIsOpen(false));

      useEffect(() => {
        if (!isOpen || isCollapsed) return;
        let cancelled = false;
        (async () => {
          try {
            await ensureWasm();
            const entries = await Promise.all(
              matches.map(async (match) => {
                const parsed = await wasm.parsePattern(getMatchPath(match));
                return [match.id, parsed.dynamic_params] as const;
              })
            );
            if (!cancelled) {
              setParamNames(Object.fromEntries(entries));
            }
          } catch {
            if (!cancelled) setParamNames({});
          }
        })();
        return () => {
          cancelled = true;
        };
      }, [isCollapsed, isOpen, matches]);

      if (!isOpen && !showLauncherWhenClosed) {
        return null;
      }

      if (!isOpen) {
        return (
          <div className="xray-root">
            <button type="button" className="xray-launcher xray-hit" onClick={toggle} aria-label="Open Route X-Ray">
              🔬 X-Ray
            </button>
          </div>
        );
      }

      const activeChain = matches.map((match) => getMatchPath(match)).join(" → ");
      const activeParams = matches[matches.length - 1]?.params ?? {};

      return (
        <div className="xray-root">
          <aside className="xray-panel" data-testid="xray-overlay">
            <div className="xray-head xray-hit">
              <span>🔬 Route X-Ray</span>
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
                        className="xray-route-row xray-hit"
                        onMouseEnter={() => highlight(routeId, path)}
                        onMouseLeave={() => clear(routeId)}
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
                <section className="xray-section xray-status">
                  <span>SCORE</span>
                  <span>{Math.round(score)}/100 {score > 60 ? "⚠" : "✓"}</span>
                </section>
                {issues.length > 0 ? (
                  <section className="xray-section">
                    {issues.map((issue) => <div key={issue}>⚠ {issue}</div>)}
                  </section>
                ) : null}
              </>
            ) : null}
          </aside>
        </div>
      );
    };
