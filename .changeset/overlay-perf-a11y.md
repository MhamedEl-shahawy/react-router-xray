---
"react-router-xray-react": patch
---

Stop WASM/analysis running every React render by memoizing data-router matches and keying work off a stable route signature. Merge analyze + parse into one idle-scheduled pass. Ignore overlay shortcuts while typing in inputs. Improve semantics (`role="region"`, labels, focus rings). Fall back to location-only matches via error boundary when `useMatches` is unavailable (e.g. BrowserRouter).