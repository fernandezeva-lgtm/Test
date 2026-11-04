// Compila cada widget (src/widgets/*.ts) en un único HTML autocontenido: dist/widgets/<nombre>.html
// Uso: node scripts/build-widgets.mjs [--watch]
import * as esbuild from "esbuild";
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src", "widgets");
const out = join(root, "dist", "widgets");
mkdirSync(out, { recursive: true });
const watch = process.argv.includes("--watch");
const FONTS = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
const entries = readdirSync(src).filter((f) => f.endsWith(".ts"));

const htmlPlugin = {
  name: "html",
  setup(build) {
    build.onEnd((res) => {
      if (res.errors.length) return;
      const css = readFileSync(join(root, "src", "design", "tokens.css"), "utf8") + readFileSync(join(src, "lib", "styles.css"), "utf8");
      for (const f of res.outputFiles ?? []) {
        const name = f.path.split(/[\\/]/).pop().replace(/\.js$/, "");
        const js = f.text.replace(/<\/script/gi, "<\\/script");
        const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title><link rel="stylesheet" href="${FONTS}"><style>${css}</style></head><body><div id="root"></div><script type="module">${js}</script></body></html>`;
        writeFileSync(join(out, `${name}.html`), html);
      }
      console.log(`[widgets] ${res.outputFiles?.length ?? 0} widgets → dist/widgets`);
    });
  },
};

// zod incluye ~40 idiomas de mensajes de error que los widgets no necesitan: solo cargamos "en".
const slimZodLocales = {
  name: "slim-zod-locales",
  setup(build) {
    build.onResolve({ filter: /locales\/index\.js$/ }, (args) =>
      args.importer.includes(`${"zod"}`) ? { path: "zod-locales-stub", namespace: "stub" } : undefined,
    );
    build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents: `export { default as en } from ${JSON.stringify(join(root, "node_modules/zod/v4/locales/en.js"))};`,
      resolveDir: root,
    }));
  },
};

const ctx = await esbuild.context({
  entryPoints: entries.map((e) => join(src, e)),
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: !watch,
  write: false,
  outdir: out,
  legalComments: "none",
  logLevel: "warning",
  plugins: [slimZodLocales, htmlPlugin],
});
if (watch) {
  await ctx.watch();
  console.log("[widgets] vigilando cambios…");
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
