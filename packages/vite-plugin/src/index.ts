import type { Plugin } from "vite";
import { analyzeRoutes } from "react-router-xray-core";

const VIRTUAL_ID = "virtual:react-router-xray";
const RESOLVED_VIRTUAL_ID = "\0virtual:react-router-xray";

export type ReactRouterXrayPluginOptions = {
  routes?: string | string[];
  failOnBuild?: boolean;
};

function normalizeRoutes(input: string | string[] | undefined): string {
  if (!input) return "";
  if (Array.isArray(input)) {
    return input
      .map((route) => route.trim())
      .filter(Boolean)
      .join("\n");
  }
  return input
    .split(/\r?\n/)
    .map((route) => route.trim())
    .filter(Boolean)
    .join("\n");
}

export default function reactRouterXrayPlugin(
  options: string | string[] | ReactRouterXrayPluginOptions = ""
): Plugin {
  const normalized =
    typeof options === "string" || Array.isArray(options)
      ? normalizeRoutes(options)
      : normalizeRoutes(options.routes);

  return {
    name: "vite-plugin-react-router-xray",
    enforce: "pre",
    configResolved() {
      const result = analyzeRoutes(normalized);
      console.info("[react-router-xray] startup analysis", result);
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
      return null;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return null;
      return "export const xrayVirtualMessage = 'React Router Xray virtual module active';";
    }
  };
}
