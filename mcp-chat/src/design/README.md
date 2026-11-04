# Finora DS

Design system del chat y de los widgets MCP Apps de Banco Finora: **azules corporativos de banca** (familia del
azul CaixaBank) sobre **negros**. Es una identidad propia de la entidad ficticia Finora: no usa logotipos, nombres
ni tipografías de ninguna marca real.

Fuente única: [`tokens.css`](tokens.css). La importan el chat (`src/web/main.tsx`) y todos los widgets (el build
la antepone a `src/widgets/lib/styles.css`).

## Color

| Token | Claro | Uso |
|---|---|---|
| `--fn-blue-600` | `#007EAE` | **Primario**: botones, enlaces, interruptores, serie principal de gráficos |
| `--fn-blue-500` | `#0099D8` | Acento: foco, detalles de marca, barra del logo |
| `--fn-blue-400` / `-300` | `#23A6DD` / `#5CBBE4` | Primario en modo oscuro, series secundarias |
| `--fn-blue-800` / `-900` | `#004B69` / `#002F43` | Fondos de marca profundos (tarjeta virtual, hipotecas) |
| `--fn-black` | `#050608` | **Superficies fuertes**: barra lateral, logo, burbuja de la usuaria, tarjeta de crédito |
| `--fn-ink-900…50` | `#121519` … `#F5F7F9` | Grises fríos para superficies, bordes y texto |
| `--fn-green-600` / `--fn-amber-600` / `--fn-red-600` | `#00875A` / `#B86E00` / `#D0021B` | Estados: éxito, aviso, error |

Los componentes usan los **semánticos** (`--ds-canvas`, `--ds-surface`, `--ds-text`, `--ds-primary`, `--ds-strong`,
`--ds-success`…), que se redefinen en modo oscuro (`prefers-color-scheme` y `data-theme="dark"`).

**Gráficos**: `--ds-chart-1` (azul), `--ds-chart-2` (negro; gris claro en oscuro), `--ds-chart-3…6` (azules y
grises). Ingresos/capital = azul; gastos/intereses = negro. Categorías de gasto: escala de azules y grises fríos
en `src/widgets/lib/runtime.ts` (`CAT`).

## Tipografía

**Plus Jakarta Sans** (400–800) para todo; **JetBrains Mono** para datos técnicos. Títulos a 750–800 con
`letter-spacing` negativo; importes con `tabular-nums`. Si no hay red, cae a la fuente del sistema.

## Forma

Radios `6 / 8 / 12 / 16 px`; botones a 10 px (chat) y píldora (widgets); sombras suaves `--ds-shadow-sm/md/lg`;
foco visible `--ds-focus` (anillo azul de 3 px).

## Marca

Logo: cuadrado negro con «F» blanca y una franja inferior azul degradada. Aparece en la barra lateral, como avatar
del asistente, en la cabecera de cada widget y en el favicon.

## Cómo llega a los widgets

1. El chat envía en `ui/initialize` las **variables estándar de MCP Apps** (`--color-background-primary`,
   `--color-text-primary`, `--font-sans`…) con los valores de Finora DS (`src/web/lib/theme.ts`).
2. El widget usa esas variables si llegan y, si no (otro host como Claude o ChatGPT), cae a los tokens `--ds-*`:
   las superficies se adaptan al host y la **marca** (azules y negro) se mantiene siempre.
3. Los recursos `ui://` declaran `_meta.ui.csp.resourceDomains` con Google Fonts para poder cargar la tipografía
   dentro del iframe aislado.
