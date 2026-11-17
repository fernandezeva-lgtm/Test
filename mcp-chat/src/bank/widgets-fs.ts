// Carga de los widgets compilados desde disco (solo Node: servidor HTTP y stdio).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WidgetId } from "./server.ts";

const WIDGETS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "dist", "widgets");

export function widgetHtmlFromDisk(w: WidgetId) {
  const file = join(WIDGETS_DIR, `${w}.html`);
  if (!existsSync(file))
    return `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:16px">Widget <b>${w}</b> sin compilar. Ejecuta <code>npm run build:widgets</code>.</body>`;
  return readFileSync(file, "utf8");
}
