import { NavLink, Outlet, Route, Routes } from "react-router-dom";
import { RouteXrayOverlay } from "react-router-xray-react";

import "./demo.css";

type DemoNavItem = { to: string; title: string; tag: string; end?: boolean };

const NAV: DemoNavItem[] = [
  { to: "/", title: "Home", tag: "minimal", end: true },
  { to: "/slow", title: "Slow", tag: "shallow chain" },
  { to: "/app/inbox", title: "App inbox", tag: "moderate depth" },
  { to: "/deep/l1/l2/l3/l4", title: "Deep URL", tag: "depth penalty" },
  { to: "/nest/two/three/leaf", title: "Nested layouts", tag: "chain penalty" },
  { to: "/wild/files/docs/readme", title: "Wildcard", tag: "splat" },
];

function Shell() {
  return (
    <div className="demo-shell">
      <div className="demo-nav-wrap">
        <p className="demo-nav-label">Sample routes · pathname shape vs clarity</p>
        <nav className="demo-nav" aria-label="Demo routes">
          {NAV.map(({ to, end, title, tag }) => (
            <NavLink
              key={to}
              to={to}
              end={end === true}
              className={({ isActive }) =>
                isActive ? "demo-route-link demo-route-link--active" : "demo-route-link"
              }
            >
              <code className="demo-route-path">{to === "/" ? "/" : to}</code>
              <span className="demo-route-meta">
                <span className="demo-route-title">{title}</span>
                <span className="demo-route-sep" aria-hidden="true">
                  ·
                </span>
                <span className="demo-route-tag">{tag}</span>
              </span>
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="demo-outlet">
        <Outlet />
      </div>
    </div>
  );
}

function NestChrome({ label }: { label: string }) {
  return (
    <div className="demo-nest">
      <div className="demo-nest-label">{label}</div>
      <Outlet />
    </div>
  );
}

function Page({ title, hint }: { title: string; hint?: string }) {
  return (
    <article className="demo-page">
      <h2 className="demo-page-title">{title}</h2>
      {hint ? <p className="demo-page-hint">{hint}</p> : null}
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
    <main className="demo-app">
      <header className="demo-header">
        <p className="demo-eyebrow">react-router-xray</p>
        <h1 className="demo-title">Route X-Ray demo</h1>
        <p className="demo-intro">
          Open <strong>Route X-Ray</strong> from the floating control or keyboard shortcuts. Each link hits a different pathname
          shape so clarity scores and penalty breakdowns change in predictable ways.
        </p>
        <div className="demo-kbd">
          <span className="demo-kbd-row">
            Toggle panel <kbd>Alt</kbd>
            <span aria-hidden>+</span>
            <kbd>R</kbd>
          </span>
          <span className="demo-kbd-row">
            Alternative <kbd>Ctrl</kbd>
            <span aria-hidden>+</span>
            <kbd>Shift</kbd>
            <span aria-hidden>+</span>
            <kbd>X</kbd>
          </span>
        </div>
      </header>

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
