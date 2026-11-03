// Prueba end-to-end con el LLM "demo": abre el chat, lanza varias peticiones y comprueba
// que los widgets MCP Apps se pintan e interactúan. Requiere el servidor arrancado (npm start).
// Uso: BASE_URL=http://localhost:8787 node scripts/e2e.mjs [carpeta-capturas]
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

// Usa playwright local si está instalado; si no, el global.
let pw;
try {
  pw = await import("playwright");
} catch {
  pw = createRequire(execSync("npm root -g").toString().trim() + "/")("playwright");
}
const { chromium } = pw;

const BASE = process.env.BASE_URL || "http://localhost:8787";
const OUT = process.argv[2] || "e2e-shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  try {
    localStorage.setItem("mcpchat.settings.v1", JSON.stringify({ provider: "demo", model: "finora-demo", apiKeys: {} }));
  } catch {
    /* iframes aislados de los widgets: sin localStorage */
  }
});

// Reinicia los datos del banco simulado usando un cliente MCP normal.
{
  const { Client, StreamableHTTPClientTransport } = await import("@modelcontextprotocol/client");
  const c = new Client({ name: "e2e", version: "1.0.0" });
  await c.connect(new StreamableHTTPClientTransport(new URL("/mcp", BASE)));
  await c.callTool({ name: "reiniciar_demo", arguments: {} });
  await c.close();
}
await page.goto(BASE);
await page.waitForSelector(".connector .dot.ready", { timeout: 15000 });

let n = 0;
async function ask(q, expectWidget = true) {
  n++;
  const before = await page.locator(".widget-box iframe").count();
  await page.locator(".composer textarea").fill(q);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector(".send.stop"), null, { timeout: 30000 });
  if (expectWidget) {
    await page.waitForFunction((b) => document.querySelectorAll(".widget-box.loaded iframe").length > b, before, { timeout: 15000 });
    const frame = page.frameLocator(".widget-box iframe").nth(before);
    await frame.locator("#root .hdr, #root .success").first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(600);
    return frame;
  }
}
const shot = async (name) => page.screenshot({ path: `${OUT}/${String(n).padStart(2, "0")}-${name}.png` });

const checks = [];
const check = (name, ok) => (checks.push([name, ok]), console.log(`${ok ? "✓" : "✗"} ${name}`));

let f = await ask("¿Cuánto dinero tengo?");
check("posición global muestra patrimonio", (await f.locator("text=Patrimonio neto").count()) > 0);
await shot("posicion");

f = await ask("¿En qué he gastado más en los últimos 6 meses?");
check("análisis muestra donut", (await f.locator("svg circle").count()) > 3);
await f.locator(".chip", { hasText: "Últimos 12 meses" }).click();
await page.waitForTimeout(800);
check("análisis cambia de periodo (tool desde widget)", (await f.locator(".hdr .sub", { hasText: "Últimos 12 meses" }).count()) > 0);
await shot("analisis");

f = await ask("Envía un Bizum de 25 € a Marta por la cena del sábado");
check("bizum prerrellenado", (await f.locator(".contact.on", { hasText: "Marta" }).count()) === 1);
await f.locator("button.btn.primary").click();
await f.locator(".otp input").first().waitFor();
await f.locator(".otp input").first().focus();
await page.keyboard.type("123456");
await f.locator(".success").waitFor({ timeout: 10000 });
check("bizum confirmado con OTP", (await f.locator("text=¡Bizum enviado!").count()) === 1);
await shot("bizum");

f = await ask("Veo un cargo raro de PayPal en mi tarjeta, ¿qué hago?");
await f.locator(".switch.danger").first().click();
const bloq = await f.getByText("BLOQUEADA TEMPORALMENTE", { exact: false }).first().waitFor({ timeout: 5000 }).then(() => true, () => false);
check("tarjeta bloqueada desde widget", bloq);
await shot("tarjetas");

f = await ask("Enséñame mis compras en Amazon");
check("movimientos filtrados", (await f.locator(".item").count()) > 3);
await f.locator(".item.click").first().click();
await f.locator("text=Preguntar al asistente").click();
await page.waitForFunction(() => document.querySelectorAll(".msg.user .from-widget").length > 0, null, { timeout: 10000 });
await page.waitForFunction(() => !document.querySelector(".send.stop"), null, { timeout: 30000 });
check("ui/message desde widget crea turno", (await page.locator(".from-widget").count()) > 0);
await shot("movimientos");

f = await ask("Simula un préstamo para un coche eléctrico de 28.000 € a 6 años");
check("simulador muestra cuota", (await f.locator("text=Cuota mensual").count()) > 0);
await shot("simulador");

for (const [q, name] of [
  ["Enséñame mis recibos, suscripciones y pagos pendientes", "recibos"],
  ["¿Qué productos tenéis?", "catalogo"],
  ["¿Cómo van mis inversiones?", "inversiones"],
  ["Ver mis objetivos de ahorro", "objetivos"],
  ["Quiero ver mis datos personales", "perfil"],
  ["¿Cuál es el límite de Bizum?", "ayuda"],
  ["Quiero hacer una transferencia de 200 euros a mi hermana", "transferencia"],
]) {
  f = await ask(q);
  check(`widget ${name} renderiza`, (await f.locator("#root").count()) === 1);
  await shot(name);
}

// Pantalla completa
await page.locator(".widget-box").last().hover();
await page.locator(".widget-tools button[title='Pantalla completa']").last().dispatchEvent("click");
const fs = await page.waitForSelector(".widget-box.mode-fullscreen", { timeout: 5000 }).catch(() => null);
check("modo pantalla completa", !!fs);
if (!fs) console.log(await page.locator(".widget-box").evaluateAll((els) => els.map((e) => e.className)));
await shot("fullscreen");
await page.locator(".widget-bar button[title='Volver al chat']").click();

// Tema oscuro
await page.locator("button[title='Cambiar tema']").click();
await page.waitForTimeout(500);
await shot("dark");

const relevant = errors.filter((e) => !/favicon|ResizeObserver|405/.test(e));
check("sin errores de consola", relevant.length === 0);
if (relevant.length) console.log(relevant.slice(0, 10));
await browser.close();
const failed = checks.filter(([, ok]) => !ok).length;
console.log(`\n${checks.length - failed}/${checks.length} comprobaciones OK`);
process.exit(failed ? 1 : 0);
