import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import reactRouterXray from "vite-plugin-react-router-xray";
export default defineConfig({
    plugins: [
        react(),
        reactRouterXray({
            routes: [
                "/",
                "/slow",
                "/app/inbox",
                "/deep/l1/l2/l3/l4",
                "/nest/two/three/leaf",
                "/wild/files/docs/readme",
            ],
        }),
    ],
});
