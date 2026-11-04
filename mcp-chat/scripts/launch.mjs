// Lanzadera de MCP Chat: instala dependencias, compila si hace falta, ofrece configurar un
// LLM gratuito la primera vez, arranca el servidor y abre el navegador.
// La usan "Abrir MCP Chat.command" (Mac), "Abrir MCP Chat.bat" (Windows) y "abrir-mcp-chat.sh" (Linux).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const isWin = process.platform === "win32";

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

const [major] = process.versions.node.split(".").map(Number);
if (major < 20) fail(`Tienes Node.js ${process.versions.node} y MCP Chat necesita la versión 20 o superior. Instala la LTS desde https://nodejs.org`);

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: isWin });
  if (r.status !== 0) fail(`Ha fallado "${cmd} ${args.join(" ")}". Revisa el mensaje de arriba.`);
}

console.log("\n  ✦ MCP Chat · Banco Finora\n");

// 1) Dependencias
if (!existsSync(path.join(root, "node_modules", "@modelcontextprotocol", "ext-apps"))) {
  console.log("→ Primera vez: instalando dependencias (puede tardar un par de minutos)…\n");
  run("npm", ["install", "--no-fund", "--no-audit"]);
}

// 2) Compilar si falta la build o el código es más nuevo
function newest(dir) {
  let t = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    t = Math.max(t, e.isDirectory() ? newest(p) : statSync(p).mtimeMs);
  }
  return t;
}
const built = path.join(root, "dist", "web", "index.html");
const widgets = path.join(root, "dist", "widgets", "posicion.html");
if (!existsSync(built) || !existsSync(widgets) || newest(path.join(root, "src")) > Math.min(statSync(built).mtimeMs, statSync(widgets).mtimeMs)) {
  console.log("→ Preparando la app (compilando widgets y web)…\n");
  run("npm", ["run", "build"]);
}

// 3) Primera vez: ofrecer conectar un LLM gratuito (opcional)
const envFile = path.join(root, ".env");
const hasKey = ["GROQ_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY"].some((k) => process.env[k]);
if (!existsSync(envFile) && !hasKey && process.stdin.isTTY) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("¿Quieres conectar un LLM gratuito? (puedes hacerlo luego desde ⚙︎ Ajustes)");
  console.log("  1) Groq    – clave gratis en https://console.groq.com/keys");
  console.log("  2) Gemini  – clave gratis en https://aistudio.google.com/apikey");
  console.log("  3) OpenRouter – clave gratis en https://openrouter.ai/keys");
  console.log("  Enter) Probar en modo demo, sin clave");
  const op = (await rl.question("\nElige [1/2/3/Enter]: ")).trim();
  const vars = { 1: "GROQ_API_KEY", 2: "GEMINI_API_KEY", 3: "OPENROUTER_API_KEY" }[op];
  let contenido = "# Creado por la lanzadera. Edita o borra este archivo para cambiar el LLM.\n";
  if (vars) {
    const key = (await rl.question(`Pega tu ${vars}: `)).trim();
    if (key) contenido += `${vars}=${key}\n`;
  }
  rl.close();
  writeFileSync(envFile, contenido);
  console.log(vars ? "\n✔ Clave guardada en mcp-chat/.env (solo en tu ordenador)." : "\n✔ Modo demo. Cuando quieras, añade una clave en ⚙︎ Ajustes.");
}

// 4) Puerto libre
function isFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port);
  });
}
let port = Number(process.env.PORT) || 8787;
while (!(await isFree(port))) {
  port++;
  if (port > 8807) fail("No hay ningún puerto libre entre 8787 y 8807.");
}
const url = `http://localhost:${port}`;

function openBrowser() {
  if (process.env.NO_BROWSER) return;
  const [cmd, args] = process.platform === "darwin" ? ["open", [url]] : isWin ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  const child = spawn(cmd, args, { stdio: "ignore", detached: true });
  child.on("error", () => console.log(`\nAbre ${url} en tu navegador.`));
  child.unref();
}

async function waitAndOpen() {
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) {
        console.log(`✔ MCP Chat está abierto en ${url}`);
        const lan = Object.values(os.networkInterfaces())
          .flat()
          .filter((i) => i && i.family === "IPv4" && !i.internal && /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(i.address))
          .map((i) => `http://${i.address}:${port}`);
        if (lan.length) console.log(`  📱 Desde el móvil (misma Wi-Fi): ${lan.join("  o  ")}`);
        console.log(`  Servidor MCP para otros clientes: ${url}/mcp`);
        console.log("  Para cerrarlo, vuelve a esta ventana y pulsa Ctrl + C.\n");
        return openBrowser();
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(`\nEstá tardando en arrancar. Prueba a abrir ${url} en tu navegador.`);
}

// 5) Arrancar (tsx directamente con Node, sin depender del shell)
console.log(`→ Arrancando en ${url}…`);
const tsx = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const server = spawn(process.execPath, [tsx, "src/backend/index.ts"], { stdio: "inherit", env: { ...process.env, PORT: String(port) } });
server.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.kill(sig));
waitAndOpen();
