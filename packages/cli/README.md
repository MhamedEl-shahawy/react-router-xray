# react-router-xray

CLI for static analysis and reporting of React Router route trees.

## Install

```bash
npm install -D react-router-xray
```

## Usage

```bash
xray routes
xray analyze
xray check --fail-on error
xray report --open
```

## Config

Create `xray.config.json` in your project root:

```json
{
  "routerFile": "src/router.tsx",
  "rules": {
    "missingErrorBoundary": "error",
    "deepNesting": { "level": "warn", "maxDepth": 4 },
    "duplicatePath": "error"
  },
  "thresholds": { "maxComplexityScore": 60 }
}
```

## Notes

Prebuilt binaries are provided for Linux, macOS, and Windows. Rust is not required to consume the published package.

## License

MIT
