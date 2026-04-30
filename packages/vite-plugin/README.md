# vite-plugin-react-router-xray

Vite plugin for startup route analysis, dev instrumentation, and virtual manifest output.

## Install

```bash
npm install -D vite-plugin-react-router-xray react-router-xray-core
```

## Usage

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import reactRouterXray from "vite-plugin-react-router-xray";

export default defineConfig({
  plugins: [react(), reactRouterXray({ failOnBuild: false })]
});
```

## Virtual module

```ts
import manifest from "virtual:react-router-xray/manifest";
```

Use the virtual manifest to read analyzed routes and aggregate analysis stats inside dev tooling.

## License

MIT
