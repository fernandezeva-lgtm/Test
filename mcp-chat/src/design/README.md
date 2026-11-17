# Finora DS

Design system del chat y de los widgets MCP Apps de Banco Finora, con el estilo de una app bancaria móvil:
**lienzo gris claro, tarjetas blancas planas sin borde, negro azulado para botones y selección**, colores
suaves (azul cielo, amarillo, melocotón) para tarjetas destacadas y azul petróleo para la ayuda. Es una
identidad de la entidad ficticia Finora: no usa logotipos, nombres ni tipografías de ninguna marca real.

Fuente única: [`tokens.css`](tokens.css). La importan el chat (`src/web/main.tsx`, `src/standalone/main.tsx`)
y todos los widgets (el build la antepone a `src/widgets/lib/styles.css`).

## Color

| Token | Valor | Uso |
|---|---|---|
| `--fn-gray-100` | `#F2F2F2` | **Lienzo** de la página y fondo de los widgets |
| `--fn-white` | `#FFFFFF` | **Tarjetas**: planas, sin borde ni sombra, esquinas de 16–18 px |
| `--fn-ink` | `#1B2129` | Texto principal, **botones principales**, chip/pestaña activa, burbuja de la usuaria, logo |
| `--fn-gray-700` | `#474E57` | Contorno de chips y botones secundarios |
| `--fn-gray-600` / `-500` | `#5F6670` / `#7B828B` | Texto secundario y terciario (fechas, subtítulos) |
| `--fn-blue` | `#3D9BE0` | Interruptores, foco, barras y serie principal de gráficos («Recibido») |
| `--fn-gray-400` | `#8C96A2` | Serie secundaria («Pendiente») |
| `--fn-blue-link` | `#1F5C8A` | Enlaces subrayados («Todos los movimientos →») |
| `--fn-sky` / `--fn-sun` / `--fn-peach` | `#9CCFF5` / `#F5D04B` / `#F6C79B` | Tarjetas destacadas y sugerencias, con texto oscuro |
| `--fn-petrol` | `#1E4A66` | Banner «¿Tienes dudas?» con botón blanco en píldora |
| `--fn-green` | `#2E7D32` | Importes a favor (`+0,19 €`), estado correcto |
| `--fn-amber` / `--fn-red` | `#9A6400` / `#C62828` | Avisos y errores |

Los componentes usan los **semánticos** (`--ds-canvas`, `--ds-surface`, `--ds-text`, `--ds-primary`,
`--ds-accent`, `--ds-link`, `--ds-outline`, `--ds-help`, `--ds-promo-*`…), redefinidos en modo oscuro
(`prefers-color-scheme` y `data-theme="dark"`): lienzo `#0F1317`, tarjetas `#1A1F25`, botones claros.

**Gráficos**: `--ds-chart-1` azul, `-2` gris, `-3` negro azulado, `-4` cielo, `-5` amarillo, `-6` petróleo.
Ingresos/capital = azul; gastos/intereses = gris. Categorías de gasto en `src/widgets/lib/runtime.ts` (`CAT`).

## Tipografía

**Figtree** (Google Fonts, 400–900): titulares muy gruesos (800–900) con `letter-spacing` negativo, texto a
400–500, importes en 800 con `tabular-nums`. Se carga sin bloquear el arranque; sin red, fuente del sistema.

## Componentes

- **Botón principal**: negro azulado, texto blanco en 800, esquinas de 12 px, ancho completo en formularios.
- **Botón secundario / chip / pestaña**: píldora blanca con contorno de 1,5 px; la activa, rellena en negro.
- **Tarjeta**: blanca sobre gris, sin borde; dentro, cajas informativas grises.
- **Viñeta con check**: círculo negro con ✓ blanco (`.tick`).
- **Enlace**: azul oscuro subrayado, con flecha.
- **Banner de ayuda**: petróleo con botón blanco en píldora.

## Marca

Logo: cuadrado negro azulado con «F» blanca y una franja inferior azul y amarilla. Aparece en la barra
lateral, como avatar del asistente, en la cabecera de cada widget y en el favicon.

## Cómo llega a los widgets

1. El chat envía en `ui/initialize` las **variables estándar de MCP Apps** (`--color-background-*`,
   `--color-text-*`, `--font-sans`…) con los valores de Finora DS (`src/web/lib/theme.ts`).
2. El widget usa esas variables si llegan y, si no (otro host como Claude o ChatGPT), cae a los tokens `--ds-*`:
   las superficies se adaptan al host y la marca se mantiene.
3. Los recursos `ui://` declaran `_meta.ui.csp.resourceDomains` con Google Fonts para cargar la tipografía
   dentro del iframe aislado.
