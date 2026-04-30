import { analyzeRoutes, init, parsePattern } from "@react-router-xray/core/wasm";
import {
  Fragment,
  type PropsWithChildren,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  useMatches,
  useNavigation,
  useRouteLoaderData
} from "react-router-dom";

export type RouteXrayState = {
  matches: ReturnType<typeof useMatches>;
  isOpen: boolean;
  toggle: () => void;
  score: number;
  issues: string[];
};

let styleInjected = false;
const XRAY_STYLE_ID = "route-xray-style";

function injectStyles() {
  if (styleInjected || typeof document === "undefined") return;
  if (document.getElementById(XRAY_STYLE_ID)) {
    styleInjected = true;
    return;
  }
  const style = document.createElement("style");
  style.id = XRAY_STYLE_ID;
  style.textContent = `
  .xray-panel{position:fixed;right:16px;bottom:16px;width:380px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:12px;font:12px/1.4 system-ui,sans-serif;z-index:2147483647;box-shadow:0 12px 32px rgba(0,0,0,.4)}
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
  `;
  document.head.appendChild(style);
  styleInjected = true;
}

function useLocalOpenState() {
  const [isOpen, setIsOpen] = useState(true);
  const toggle = () => setIsOpen((current) => !current);
  return { isOpen, setIsOpen, toggle };
}

export function useRouteXray(): RouteXrayState {
  const matches = useMatches();
  const navigation = useNavigation();
  const { isOpen, toggle } = useLocalOpenState();
  const [score, setScore] = useState(0);
  const [issues, setIssues] = useState<string[]>([]);

  // Explicit hook usage requested for router loader state.
  const activeMatchId = matches[matches.length - 1]?.id ?? "__xray_missing__";
  const activeLoaderData = useRouteLoaderData(activeMatchId);

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    const routeLines = matches.map((match) => (match.pathname || "/").trim()).join("\n");
    let cancelled = false;
    (async () => {
      await init();
      const result = await analyzeRoutes(routeLines);
      if (cancelled) return;
      setScore(Math.max(0, Math.min(100, Number(result.score) || 0)));
      setIssues(
        result.score > 70
          ? ["Complexity above recommended threshold"]
          : []
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [matches]);

  useEffect(() => {
    if (navigation.state === "loading") {
      setIssues((prev) => (prev.includes("Navigation loading") ? prev : [...prev, "Navigation loading"]));
    } else {
      setIssues((prev) => prev.filter((entry) => entry !== "Navigation loading"));
    }
  }, [navigation.state]);

  useEffect(() => {
    if (activeLoaderData === undefined) return;
    setIssues((prev) => prev.filter((entry) => entry !== "No loader data for active route"));
  }, [activeLoaderData]);

  return { matches, isOpen, toggle, score, issues };
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
      if (event.altKey && (event.key === "r" || event.key === "R")) {
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
  const observerRef = useRef<MutationObserver | null>(null);
  useEffect(() => {
    if (typeof document === "undefined") return;
    observerRef.current = new MutationObserver(() => undefined);
    observerRef.current.observe(document.body, { childList: true, subtree: true });
    return () => observerRef.current?.disconnect();
  }, []);

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

function getMatchPath(match: ReturnType<typeof useMatches>[number]): string {
  return match.pathname || "/";
}

export const RouteXrayOverlay =
  process.env.NODE_ENV === "production"
    ? () => null
    : function RouteXrayOverlayImpl() {
      const matches = useMatches();
      const navigation = useNavigation();
      const { isOpen, setIsOpen, toggle } = useLocalOpenState();
      const { score, issues } = useRouteXray();
      const [paramNames, setParamNames] = useState<Record<string, string[]>>({});
      const { highlight, clear } = useHoverInstrumentation();

      useKeyboardShortcuts(toggle, () => setIsOpen(false));

      useEffect(() => {
        let cancelled = false;
        (async () => {
          const entries = await Promise.all(
            matches.map(async (match) => {
              const parsed = await parsePattern(getMatchPath(match));
              return [match.id, parsed.dynamic_params] as const;
            })
          );
          if (!cancelled) {
            setParamNames(Object.fromEntries(entries));
          }
        })();
        return () => {
          cancelled = true;
        };
      }, [matches]);

      if (!isOpen) return null;

      const activeChain = matches.map((match) => getMatchPath(match)).join(" → ");
      const activeParams = matches[matches.length - 1]?.params ?? {};

      return (
        <aside className="xray-panel" data-testid="xray-overlay">
          <div className="xray-head">
            <span>🔬 Route X-Ray</span>
            <div className="xray-controls">
              <button onClick={toggle} aria-label="Minimize panel">−</button>
              <button onClick={() => setIsOpen(false)} aria-label="Close panel">✕</button>
            </div>
          </div>

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
                  className="xray-route-row"
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
            <span>● {navigation.state}</span>
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
        </aside>
      );
    };
