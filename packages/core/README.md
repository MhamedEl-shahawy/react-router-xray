# react-router-xray-core

Core analysis package used by the React overlay, Vite plugin, and CLI.

## Install

```bash
npm install react-router-xray-core
```

## Exports

`react-router-xray-core` provides JavaScript bindings and a WASM entrypoint.

```ts
import { analyzeRoutes } from "react-router-xray-core";
import { init, parsePattern } from "react-router-xray-core/wasm";
```

## API (high level)

`analyzeRoutes(input)` analyzes a route manifest or route list and returns score and diagnostics metadata.

`parsePattern(path)` parses route patterns and returns dynamic parameter details used by overlay/runtime tooling.

`init()` initializes the WASM module in browser consumers before calling WASM exports.

## License

MIT
