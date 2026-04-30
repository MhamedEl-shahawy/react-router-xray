import type { Plugin } from "vite";
import { analyzeRoutes } from "react-router-xray-core";

const VIRTUAL_ID = "virtual:react-router-xray";
const RESOLVED_VIRTUAL_ID = "\0virtual:react-router-xray";

export default function reactRouterXrayPlugin(routeManifest = ""): Plugin {
  return {
    name: "vite-plugin-react-router-xray",
    enforce: "pre",
    configResolved() {
      const result = analyzeRoutes(routeManifest);
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
