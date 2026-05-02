---
"react-router-xray-core": patch
"react-router-xray-react": patch
---

Replace stubbed browser `analyzeRoutes` scoring with a path-based heuristic aligned to the Rust analyzer formula; return structured insights and metrics. Overlay shows SCORE legend (collapsible), metric breakdown, and INSIGHTS list; `useRouteXray` exposes `insights` and `metrics` instead of `issues`.