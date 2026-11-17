// Genera la versión compartible de MCP Chat: un único HTML autocontenido, sin servidor.
//   dist/share/finora-chat.html           → ábrelo o súbelo a cualquier hosting estático
//   dist/share/finora-chat.artifact.html  → el mismo contenido, listo para publicar como Artifact de claude.ai
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
execSync("npx vite build -c vite.standalone.config.ts", { cwd: root, stdio: "inherit" });

const outDir = join(root, "dist", "standalone-build");
let html = readFileSync(join(outDir, "index.html"), "utf8");
const assets = join(outDir, "assets");
const files = readdirSync(assets);
// Escapa lo que no debe aparecer literal dentro de <script>: el cierre de etiqueta y U+FFFD
// (algunas librerías lo llevan literal; "\\uFFFD" es el mismo carácter para JS).
const inlineSafe = (code) => code.replace(/<\/script/gi, "<\\/script").replace(/\uFFFD/g, "\\uFFFD");

// <link rel="stylesheet" href="./assets/x.css"> → <style>
html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/assets\/([^"]+\.css)"[^>]*>/g, (_, f) => `<style>${readFileSync(join(assets, f), "utf8")}</style>`);
// <script type="module" src="./assets/x.js"></script> → script en línea, al final del body
let scripts = "";
html = html.replace(/<script type="module"[^>]*src="\.\/assets\/([^"]+\.js)"[^>]*><\/script>/g, (_, f) => {
  scripts += `<script type="module">${inlineSafe(readFileSync(join(assets, f), "utf8"))}</script>`;
  return "";
});
html = html.replace("</body>", () => `${scripts}</body>`); // función: el JS minificado contiene $', $& …
if (/\.\/assets\//.test(html)) throw new Error(`Quedan referencias a assets sin incrustar: ${files.join(", ")}`);

const share = join(root, "dist", "share");
mkdirSync(share, { recursive: true });
writeFileSync(join(share, "finora-chat.html"), html);

// Versión Artifact: sin doctype/html/head/body (el visor añade su propio esqueleto).
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>\s*/i, "").replace(/<meta name="viewport"[^>]*>\s*/i, "");
// El último </body>: el JS minificado puede contener el texto "</body>" dentro de una cadena.
const body = html.slice(html.indexOf("<body>") + "<body>".length, html.lastIndexOf("</body>"));
writeFileSync(join(share, "finora-chat.artifact.html"), `${head.trim()}\n${body.trim()}\n`);

const mb = (s) => (Buffer.byteLength(s) / 1024 / 1024).toFixed(2);
console.log(`\n✔ dist/share/finora-chat.html (${mb(html)} MB) y finora-chat.artifact.html listos.`);
