// Gráficos SVG ligeros (sin dependencias): donut, barras, líneas, sparkline y anillos de progreso.
import { h } from "./runtime.ts";

const NS = "http://www.w3.org/2000/svg";
function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number | undefined> = {}, ...children: (SVGElement | string | null)[]) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) el.setAttribute(k, String(v));
  for (const c of children) if (c != null) el.append(typeof c === "string" ? document.createTextNode(c) : c);
  return el;
}

let tipEl: HTMLDivElement | null = null;
function tip(el: Element, text: () => string) {
  el.addEventListener("mousemove", (e) => {
    const ev = e as MouseEvent;
    if (!tipEl) {
      tipEl = h("div", { class: "tip" });
      document.body.appendChild(tipEl);
    }
    tipEl.textContent = text();
    tipEl.classList.add("show");
    const w = tipEl.offsetWidth;
    tipEl.style.left = `${Math.min(window.innerWidth - w - 6, Math.max(6, ev.clientX - w / 2))}px`;
    tipEl.style.top = `${ev.clientY - 34}px`;
  });
  el.addEventListener("mouseleave", () => tipEl?.classList.remove("show"));
}

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};
const kfmt = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })}k` : `${Math.round(v)}`);

export interface Slice {
  label: string;
  value: number;
  color: string;
}

export function donut(data: Slice[], opts: { size?: number; thickness?: number; center?: [string, string]; onClick?: (s: Slice) => void; fmt?: (n: number) => string } = {}) {
  const size = opts.size ?? 168;
  const th = opts.thickness ?? 22;
  const r = (size - th) / 2;
  const C = 2 * Math.PI * r;
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const svg = s("svg", { viewBox: `0 0 ${size} ${size}`, width: size, height: size, style: "flex:none" });
  svg.append(s("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: "var(--bg3)", "stroke-width": th }));
  let off = 0;
  for (const d of data) {
    const len = (d.value / total) * C;
    const c = s("circle", {
      cx: size / 2,
      cy: size / 2,
      r,
      fill: "none",
      stroke: d.color,
      "stroke-width": th,
      "stroke-dasharray": `${Math.max(0, len - 1.5)} ${C}`,
      "stroke-dashoffset": -off,
      transform: `rotate(-90 ${size / 2} ${size / 2})`,
      style: `cursor:${opts.onClick ? "pointer" : "default"};transition:stroke-width .15s`,
    });
    tip(c, () => `${d.label}: ${opts.fmt ? opts.fmt(d.value) : d.value} (${Math.round((d.value / total) * 100)}%)`);
    c.addEventListener("mouseenter", () => c.setAttribute("stroke-width", String(th + 5)));
    c.addEventListener("mouseleave", () => c.setAttribute("stroke-width", String(th)));
    if (opts.onClick) c.addEventListener("click", () => opts.onClick!(d));
    svg.append(c);
    off += len;
  }
  if (opts.center) {
    svg.append(s("text", { x: size / 2, y: size / 2 - 2, "text-anchor": "middle", style: "font-size:17px;font-weight:700;fill:var(--fg)" }, opts.center[0]));
    svg.append(s("text", { x: size / 2, y: size / 2 + 15, "text-anchor": "middle", style: "font-size:11px" }, opts.center[1]));
  }
  return svg;
}

export interface Series {
  name: string;
  color: string;
  values: number[];
}

export function bars(labels: string[], series: Series[], opts: { height?: number; width?: number; stacked?: boolean; fmt?: (n: number) => string; onClick?: (i: number) => void; highlight?: number } = {}) {
  const W = opts.width ?? 600;
  const H = opts.height ?? 190;
  const pad = { l: 38, r: 6, t: 10, b: 22 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = niceMax(
    Math.max(...labels.map((_, i) => (opts.stacked ? series.reduce((a, se) => a + (se.values[i] ?? 0), 0) : Math.max(...series.map((se) => se.values[i] ?? 0))))),
  );
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img" });
  for (let k = 0; k <= 4; k++) {
    const y = pad.t + ih - (ih * k) / 4;
    svg.append(s("line", { x1: pad.l, x2: W - pad.r, y1: y, y2: y, stroke: "var(--line2)", "stroke-dasharray": k ? "3 3" : undefined }));
    svg.append(s("text", { x: pad.l - 6, y: y + 3.5, "text-anchor": "end" }, kfmt((max * k) / 4)));
  }
  const gw = iw / labels.length;
  const nb = opts.stacked ? 1 : series.length;
  const bw = Math.min(26, (gw * 0.72) / nb);
  labels.forEach((lab, i) => {
    const gx = pad.l + gw * i + (gw - bw * nb - (nb - 1) * 2) / 2;
    let acc = 0;
    series.forEach((se, j) => {
      const v = se.values[i] ?? 0;
      const bh = (v / max) * ih;
      const x = opts.stacked ? gx : gx + j * (bw + 2);
      const y = pad.t + ih - bh - (opts.stacked ? (acc / max) * ih : 0);
      acc += v;
      const rect = s("rect", {
        x,
        y,
        width: bw,
        height: Math.max(0, bh),
        rx: Math.min(4, bw / 3),
        fill: se.color,
        opacity: opts.highlight != null && opts.highlight !== i ? 0.45 : 1,
        style: `cursor:${opts.onClick ? "pointer" : "default"}`,
      });
      tip(rect, () => `${lab} · ${se.name}: ${opts.fmt ? opts.fmt(v) : v}`);
      if (opts.onClick) rect.addEventListener("click", () => opts.onClick!(i));
      svg.append(rect);
    });
    if (labels.length <= 14 || i % Math.ceil(labels.length / 12) === 0)
      svg.append(s("text", { x: pad.l + gw * i + gw / 2, y: H - 6, "text-anchor": "middle" }, lab));
  });
  return svg;
}

export function line(labels: string[], series: Series[], opts: { height?: number; width?: number; area?: boolean; fmt?: (n: number) => string; minZero?: boolean } = {}) {
  const W = opts.width ?? 600;
  const H = opts.height ?? 180;
  const pad = { l: 42, r: 10, t: 12, b: 22 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const all = series.flatMap((x) => x.values);
  let lo = opts.minZero ? 0 : Math.min(...all);
  const hi = Math.max(...all);
  if (!opts.minZero) lo = lo - (hi - lo) * 0.15;
  const span = hi - lo || 1;
  const X = (i: number) => pad.l + (iw * i) / Math.max(1, labels.length - 1);
  const Y = (v: number) => pad.t + ih - ((v - lo) / span) * ih;
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%" });
  for (let k = 0; k <= 3; k++) {
    const v = lo + (span * k) / 3;
    svg.append(s("line", { x1: pad.l, x2: W - pad.r, y1: Y(v), y2: Y(v), stroke: "var(--line2)", "stroke-dasharray": "3 3" }));
    svg.append(s("text", { x: pad.l - 6, y: Y(v) + 3.5, "text-anchor": "end" }, kfmt(v)));
  }
  const step = Math.ceil(labels.length / 8);
  labels.forEach((l, i) => {
    if (i % step === 0 || i === labels.length - 1) svg.append(s("text", { x: X(i), y: H - 6, "text-anchor": "middle" }, l));
  });
  const gid = `g${Math.random().toString(36).slice(2, 8)}`;
  series.forEach((se, j) => {
    const d = se.values.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
    if (opts.area && j === 0) {
      svg.append(
        s("defs", {}, s("linearGradient", { id: gid, x1: 0, x2: 0, y1: 0, y2: 1 }, s("stop", { offset: "0", "stop-color": se.color, "stop-opacity": 0.28 }), s("stop", { offset: "1", "stop-color": se.color, "stop-opacity": 0 }))),
      );
      svg.append(s("path", { d: `${d} L${X(se.values.length - 1)},${pad.t + ih} L${X(0)},${pad.t + ih} Z`, fill: `url(#${gid})` }));
    }
    svg.append(s("path", { d, fill: "none", stroke: se.color, "stroke-width": 2.2, "stroke-linejoin": "round", "stroke-linecap": "round", "stroke-dasharray": j > 0 ? "5 4" : undefined }));
  });
  // Guía vertical con tooltip
  const guide = s("line", { y1: pad.t, y2: pad.t + ih, stroke: "var(--fg3)", "stroke-width": 1, opacity: 0 });
  const dot = s("circle", { r: 4, fill: series[0]?.color ?? "#000", stroke: "var(--bg)", "stroke-width": 2, opacity: 0 });
  svg.append(guide, dot);
  const hit = s("rect", { x: pad.l, y: pad.t, width: iw, height: ih, fill: "transparent" });
  let idx = 0;
  hit.addEventListener("mousemove", (e) => {
    const r = svg.getBoundingClientRect();
    const x = (((e as MouseEvent).clientX - r.left) / r.width) * W;
    idx = Math.max(0, Math.min(labels.length - 1, Math.round(((x - pad.l) / iw) * (labels.length - 1))));
    guide.setAttribute("x1", String(X(idx)));
    guide.setAttribute("x2", String(X(idx)));
    guide.setAttribute("opacity", "1");
    dot.setAttribute("cx", String(X(idx)));
    dot.setAttribute("cy", String(Y(series[0].values[idx])));
    dot.setAttribute("opacity", "1");
  });
  hit.addEventListener("mouseleave", () => {
    guide.setAttribute("opacity", "0");
    dot.setAttribute("opacity", "0");
  });
  tip(hit, () => `${labels[idx]} · ${series.map((se) => `${se.name}: ${opts.fmt ? opts.fmt(se.values[idx]) : se.values[idx]}`).join(" · ")}`);
  svg.append(hit);
  return svg;
}

export function sparkline(values: number[], color = "var(--brand-2)", w = 120, hgt = 34) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${((w - 4) * i) / Math.max(1, values.length - 1) + 2},${hgt - 3 - ((v - lo) / span) * (hgt - 6)}`);
  return s(
    "svg",
    { viewBox: `0 0 ${w} ${hgt}`, width: w, height: hgt },
    s("polyline", { points: pts.join(" "), fill: "none", stroke: color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }),
    s("circle", { cx: pts[pts.length - 1].split(",")[0], cy: pts[pts.length - 1].split(",")[1], r: 3, fill: color }),
  );
}

export function ring(pctValue: number, color: string, size = 64, label?: string) {
  const th = 7;
  const r = (size - th) / 2;
  const C = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pctValue));
  const arc = s("circle", {
    cx: size / 2,
    cy: size / 2,
    r,
    fill: "none",
    stroke: color,
    "stroke-width": th,
    "stroke-linecap": "round",
    "stroke-dasharray": `0 ${C}`,
    transform: `rotate(-90 ${size / 2} ${size / 2})`,
    style: "transition: stroke-dasharray .8s cubic-bezier(.2,.8,.2,1)",
  });
  requestAnimationFrame(() => requestAnimationFrame(() => arc.setAttribute("stroke-dasharray", `${(v / 100) * C} ${C}`)));
  return s(
    "svg",
    { viewBox: `0 0 ${size} ${size}`, width: size, height: size, style: "flex:none" },
    s("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: "var(--bg3)", "stroke-width": th }),
    arc,
    s("text", { x: size / 2, y: size / 2 + 4, "text-anchor": "middle", style: "font-size:13px;font-weight:700;fill:var(--fg)" }, label ?? `${Math.round(v)}%`),
  );
}

export function legend(items: { label: string; color: string; value?: string }[]) {
  return h("div", { class: "legend" }, ...items.map((i) => h("span", null, h("i", { style: { background: i.color } }), i.label, i.value ? h("span", { class: "faint" }, ` ${i.value}`) : null)));
}
