import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import reactRouterXray from "vite-plugin-react-router-xray";
export default defineConfig({
    plugins: [react(), reactRouterXray("/\n/dashboard\n/settings")]
});
