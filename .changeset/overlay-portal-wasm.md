---
"react-router-xray-react": patch
---

Portal launcher and panel to `document.body` with fixed positioning so the FAB stays clickable inside transformed layouts. Load WASM via dynamic `import()` only after opening. Surface WASM failures inline instead of crashing; reset init on failure for retries.