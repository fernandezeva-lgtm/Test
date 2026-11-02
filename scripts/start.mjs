// Arranca Mis Finanzas de principio a fin: instala dependencias, crea la
// configuración, lanza el servidor y abre el navegador. Lo usan los accesos
// directos "Abrir Mis Finanzas" (Mac y Windows).
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const isWin = process.platform === "win32";

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 9)) {
  fail(`Tienes Node.js ${process.versions.node} y la app necesita la versión 20.9 o superior. Instala la versión LTS desde https://nodejs.org`);
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: isWin });
  if (r.status !== 0) fail(`Ha fallado "${cmd} ${args.join(" ")}". Revisa el mensaje de arriba.`);
}

if (!existsSync(path.join(root, "node_modules", "next"))) {
  console.log("\n→ Primera vez: instalando dependencias (puede tardar un par de minutos)…\n");
  run("npm", ["install", "--no-fund", "--no-audit"]);
}

if (!existsSync(path.join(root, ".env.local"))) {
  run("node", ["scripts/setup.mjs"]);
}

function isFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port);
  });
}

let port = 3000;
while (!(await isFree(port))) {
  port++;
  if (port > 3020) fail("No hay ningún puerto libre entre 3000 y 3020.");
}
const url = `http://localhost:${port}`;

function openBrowser() {
  const [cmd, args] =
    process.platform === "darwin" ? ["open", [url]] : isWin ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  const child = spawn(cmd, args, { stdio: "ignore", detached: true });
  child.on("error", () => console.log(`\nAbre ${url} en tu navegador.`));
  child.unref();
}

async function waitAndOpen() {
  for (let i = 0; i < 180; i++) {
    try {
      const res = await fetch(url);
      if (res.status < 500) {
        console.log(`\n✔ Mis Finanzas está abierta en ${url}`);
        console.log("  Para cerrarla, vuelve a esta ventana y pulsa Ctrl + C.\n");
        return openBrowser();
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(`\nLa app está tardando en arrancar. Prueba a abrir ${url} en tu navegador.`);
}

console.log(`\n→ Arrancando Mis Finanzas en ${url}…\n`);
const server = spawn("npm", ["run", "dev", "--", "-p", String(port)], { stdio: "inherit", shell: isWin });
server.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.kill(sig));
waitAndOpen();
