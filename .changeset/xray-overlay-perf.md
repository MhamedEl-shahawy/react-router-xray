---
"react-router-xray-react": patch
"vite-plugin-react-router-xray": patch
---

Make the overlay non-blocking via a full-viewport pointer-events pass-through root and explicit hit targets. Lazy-init WASM only when analysis runs. Add optional `RouteXrayOverlay` props (`defaultOpen`, `showLauncherWhenClosed`). Remove stray compiled `src/index.js` that could shadow source in tooling.

Defer Vite plugin startup analysis to a microtask and add `startupAnalysis: false` to skip it entirely.