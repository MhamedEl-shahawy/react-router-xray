import { Link, Outlet, Route, Routes } from "react-router-dom";
import { RouteXrayOverlay } from "react-router-xray-react";

function Shell() {
  return (
    <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 16, marginBottom: 16 }}>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#475569", maxWidth: 720 }}>
        Use Route X-Ray (corner button or Alt+R). Each destination uses a different pathname shape so{" "}
        <strong>structural clarity</strong> moves between minimal and heavy.
      </p>
      <nav style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <Link to="/">Home · minimal</Link>
        <span style={{ color: "#cbd5e1" }}>|</span>
        <Link to="/slow">Slow · shallow chain</Link>
        <span style={{ color: "#cbd5e1" }}>|</span>
        <Link to="/app/inbox">App inbox · moderate depth</Link>
        <span style={{ color: "#cbd5e1" }}>|</span>
        <Link to="/deep/l1/l2/l3/l4">Deep URL · depth penalty</Link>
        <span style={{ color: "#cbd5e1" }}>|</span>
        <Link to="/nest/two/three/leaf">Nested layouts · chain penalty</Link>
        <span style={{ color: "#cbd5e1" }}>|</span>
        <Link to="/wild/files/docs/readme">Wildcard segment</Link>
      </nav>
      <Outlet />
    </div>
  );
}

function NestChrome({ label }: { label: string }) {
  return (
    <div style={{ marginTop: 12, paddingLeft: 14, borderLeft: "3px solid #94a3b8" }}>
      <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.04em", marginBottom: 8 }}>
        {label}
      </div>
      <Outlet />
    </div>
  );
}

function Page({ title, hint }: { title: string; hint?: string }) {
  return (
    <article style={{ marginTop: 20 }}>
      <h2 style={{ margin: "0 0 8px" }}>{title}</h2>
      {hint ? <p style={{ margin: 0, color: "#64748b", fontSize: 14, maxWidth: 640 }}>{hint}</p> : null}
    </article>
  );
}

const xh = (
  component: string,
  extras?: Partial<{ lazy: boolean; errorBoundary: boolean }>
): { handle: { xray: { component: string; lazy: boolean; errorBoundary: boolean } } } => ({
  handle: {
    xray: {
      component,
      lazy: extras?.lazy ?? false,
      errorBoundary: extras?.errorBoundary ?? false,
    },
  },
});

export default function App() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 900 }}>
      <h1 style={{ marginTop: 0 }}>React Router X-Ray demo</h1>
      <Routes>
        <Route path="/" element={<Shell />}>
          <Route
            index
            element={
              <Page
                title="Home"
                hint="Usually the highest clarity: short matched chain and shallow pathnames."
              />
            }
            {...xh("HomePage")}
          />
          <Route
            path="slow"
            element={
              <Page
                title="Slow route"
                hint="Two pathname rows (shell + leaf). Still a strong score—compare with nested and deep URLs."
              />
            }
            {...xh("SlowRoute")}
          />
          <Route
            path="app/inbox"
            element={
              <Page
                title="App inbox"
                hint="/app/inbox adds segment depth; clarity should sit in the moderate band."
              />
            }
            {...xh("AppInbox", { lazy: true })}
          />
          <Route
            path="deep/l1/l2/l3/l4"
            element={
              <Page
                title="Deep flat URL"
                hint="Single route definition but many segments—depth penalties dominate."
              />
            }
            {...xh("DeepFlat")}
          />
          <Route path="nest" element={<NestChrome label="Nest · layout row 1" />} {...xh("NestL1")}>
            <Route path="two" element={<NestChrome label="Nest · layout row 2" />} {...xh("NestL2")}>
              <Route path="three" element={<NestChrome label="Nest · layout row 3" />} {...xh("NestL3")}>
                <Route
                  path="leaf"
                  element={
                    <Page
                      title="Nested chain leaf"
                      hint="Several layout matches for one URL—matched-chain penalty stacks."
                    />
                  }
                  {...xh("NestLeaf", { lazy: true, errorBoundary: true })}
                />
              </Route>
            </Route>
          </Route>
          <Route
            path="wild/*"
            element={
              <Page
                title="Wildcard route"
                hint="Catch‑all routes often sit at the end of a branch—compare matched pathname rows and penalties with the deep URL link."
              />
            }
            {...xh("WildcardCatch")}
          />
        </Route>
      </Routes>
      <RouteXrayOverlay />
    </main>
  );
}
