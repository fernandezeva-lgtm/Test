// Build de la versión compartible: todo en un único HTML (sin backend).
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = import.meta.dirname;

// Igual que scripts/build-widgets.mjs: zod solo con el idioma "en".
const slimZodLocales: esbuild.Plugin = {
  name: "slim-zod-locales",
  setup(build) {
    build.onResolve({ filter: /locales\/index\.js$/ }, (args) => (args.importer.includes("zod") ? { path: "zod-locales-stub", namespace: "stub" } : undefined));
    build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents: `export { default as en } from ${JSON.stringify(join(root, "node_modules/zod/v4/locales/en.js"))};`,
      resolveDir: root,
    }));
  },
};

/** virtual:finora-widgets → el JS de todos los widgets (un solo bundle) y su CSS, como cadenas. */
function finoraWidgets(): Plugin {
  const id = "virtual:finora-widgets";
  return {
    name: "finora-widgets",
    resolveId: (s) => (s === id ? "\0" + id : undefined),
    async load(s) {
      if (s !== "\0" + id) return;
      const r = await esbuild.build({
        entryPoints: [join(root, "src/standalone/widgets-all.ts")],
        bundle: true,
        format: "esm",
        target: "es2022",
        minify: true,
        write: false,
        legalComments: "none",
        logLevel: "warning",
        plugins: [slimZodLocales],
      });
      const js = r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
      const css = readFileSync(join(root, "src/design/tokens.css"), "utf8") + readFileSync(join(root, "src/widgets/lib/styles.css"), "utf8");
      return `export const WIDGET_JS = ${JSON.stringify(js)};\nexport const WIDGET_CSS = ${JSON.stringify(css)};`;
    },
  };
}

export default defineConfig({
  root: "src/standalone",
  base: "./",
  plugins: [react(), finoraWidgets()],
  build: {
    outDir: "../../dist/standalone-build",
    emptyOutDir: true,
    modulePreload: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
