import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backend = `http://localhost:${process.env.PORT || 8787}`;

export default defineConfig({
  root: "src/web",
  plugins: [react()],
  build: { outDir: "../../dist/web", emptyOutDir: true },
  server: {
    port: 5173,
    host: true,
    proxy: { "/mcp": backend, "/api": backend },
  },
});
