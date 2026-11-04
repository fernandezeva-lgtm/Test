# Mis Finanzas

> **Nuevo:** [`mcp-chat/`](mcp-chat/README.md) es un clon de ChatGPT/Claude basado en **MCP Apps** con un servidor MCP
> bancario (Banco Finora, simulado) que pinta widgets interactivos (gráficos, formularios, Bizum, transferencias, tarjetas…)
> y funciona con LLMs gratuitos (Groq, Gemini, OpenRouter, Ollama) o en modo demo sin claves.
> **Pruébalo:** doble clic en `Abrir MCP Chat.command` (Mac) / `Abrir MCP Chat.bat` (Windows) / `abrir-mcp-chat.sh` (Linux),
> o [ábrelo en Codespaces](https://codespaces.new/fernandezeva-lgtm/Test?ref=ccr-98029570-sgtshm&devcontainer_path=.devcontainer/mcp-chat/devcontainer.json).

Agregador de cuentas bancarias con asistente financiero de IA, al estilo de Goin o Fintonic.

- **Login con Google** (Auth.js / NextAuth v5).
- **Agregación bancaria con [Plaid](https://plaid.com)** (acceso PSD2 de solo lectura) para los 10 principales bancos de España: CaixaBank, Santander, BBVA, Sabadell, Bankinter, Unicaja, Abanca, Kutxabank, Ibercaja y Cajamar.
- **Panel de resumen**: patrimonio neto, activos y deudas, ingresos y gastos del mes, gastos por categoría y últimos movimientos.
- **Finn, el asistente con IA** (Claude): conversa sobre las finanzas del usuario y consulta sus cuentas y movimientos mediante herramientas.
- Diseño moderno con una paleta inspirada en CaixaBank (azul corporativo, estrella amarilla y acento rojo).

Stack: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · `plaid` + `react-plaid-link` · `@anthropic-ai/sdk`.

## Probar sin instalar nada (móvil o navegador)

Abre este enlace con tu cuenta de GitHub y pulsa **Create codespace**:

**https://codespaces.new/fernandezeva-lgtm/Test?ref=claude/finanzas-agregacion-bancaria-amuwhk**

GitHub prepara la app en la nube (la primera vez tarda 2-3 minutos) y la abre en una pestaña nueva. Entra con
**"Entrar en modo demo"**. Para usar el asistente Finn, crea un secreto `ANTHROPIC_API_KEY` en
GitHub → Settings → Codespaces → Secrets, asígnalo a este repositorio y reinicia el codespace.

## En tu ordenador con doble clic

Descarga el código y haz doble clic en **`Abrir Mis Finanzas.command`** (Mac) o **`Abrir Mis Finanzas.bat`**
(Windows). La primera vez instala lo necesario; después arranca la app y abre el navegador. En Mac, si avisa
de "desarrollador no identificado", haz clic derecho → Abrir.


Necesitas [Node.js](https://nodejs.org) 20 o superior.

```bash
npm install
npm run setup   # crea .env.local con claves generadas y el modo demo activado
npm run dev     # abre http://localhost:3000 y pulsa "Entrar en modo demo"
```

Para usar el asistente Finn, añade tu `ANTHROPIC_API_KEY` en `.env.local` y reinicia `npm run dev`.

### Variables de entorno

| Variable | Para qué sirve |
|---|---|
| `AUTH_SECRET` | Firma y cifra la cookie de sesión. Genera uno con `npx auth secret`. |
| `TOKEN_ENCRYPTION_KEY` | Clave AES de 32 bytes (base64) solo para cifrar los `access_token` de Plaid. `openssl rand -base64 32`. |
| `ALLOWED_EMAILS` | Opcional. Lista blanca de emails o dominios (`ana@gmail.com,@empresa.es`). Vacío = cualquier cuenta de Google verificada. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Cliente OAuth de Google. URI de redirección: `http://localhost:3000/api/auth/callback/google`. |
| `DEMO_LOGIN` | `true` muestra el botón "Entrar en modo demo" (solo en desarrollo; también aparece si falta Google). |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` / `PLAID_ENV` | Credenciales de Plaid (`sandbox` o `production`). |
| `ANTHROPIC_API_KEY` | Clave de la API de Claude para el asistente. |

### Modo demostración

Sin credenciales de Plaid la app sigue funcionando: al pulsar un banco se crea una conexión simulada con
6 meses de cuentas y movimientos realistas (nóminas, alquiler, Mercadona, suscripciones…). Con
`DEMO_LOGIN=true` tampoco hace falta Google. Así puedes probar el panel y el asistente solo con
`AUTH_SECRET` y `ANTHROPIC_API_KEY`.

### Plaid

- Link se abre con `country_codes: ["ES"]`, `language: "es"` y el producto `transactions`.
- En **sandbox** usa las credenciales de prueba `user_good` / `pass_good`.
- La entidad que el usuario elige dentro de Plaid Link es la que se guarda (se asocia a nuestro catálogo por nombre).
- Los `access_token` se guardan cifrados con AES-256-GCM (clave propia derivada con HKDF y ligada a usuario + conexión). Al desconectar un banco se llama a `/item/remove`.

## Seguridad

| Secreto | Dónde vive | Quién lo ve |
|---|---|---|
| `PLAID_SECRET`, `ANTHROPIC_API_KEY`, `AUTH_GOOGLE_SECRET` | Variables de entorno del servidor | Solo el servidor (nunca llegan al navegador) |
| `AUTH_SECRET` | Variable de entorno | Firma/cifra la cookie de sesión (JWE, `httpOnly`) |
| `TOKEN_ENCRYPTION_KEY` | Variable de entorno (en producción, KMS) | Solo el servidor, para descifrar tokens de Plaid |
| `access_token` de Plaid | `.data/store.json`, cifrado AES-256-GCM | Se descifra en memoria solo al llamar a Plaid |
| `public_token` / `link_token` | Navegador (efímeros, de un solo uso, ~30 min) | Usuario |
| Claves del banco del usuario | **Nunca pasan por la app** (las introduce en Plaid Link) | Plaid y el banco |

Medidas aplicadas: logs sin secretos (los errores de Plaid se resumen, sin cabeceras ni cuerpo), email de Google
verificado y lista blanca opcional, límite de 20 mensajes / 10 min y tamaño máximo en el chat, cabeceras HSTS /
`X-Frame-Options` / `nosniff`, chat sin imágenes Markdown (evita exfiltración por prompt injection) y `.env*` y
`.data/` fuera de git.

## Arquitectura

```
app/
  page.tsx                    Landing + login con Google
  (app)/dashboard             Panel de resumen
  (app)/asistente             Chat con Finn
  api/auth/[...nextauth]      Auth.js
  api/plaid/link-token        Crea el link_token de Plaid
  api/plaid/exchange          public_token -> access_token (cifrado)
  api/connections             Alta demo / baja de conexiones
  api/finance                 Cuentas, movimientos y resumen agregados
  api/chat                    Agente de IA (respuesta en streaming NDJSON)
lib/
  banks.ts                    Catálogo de los 10 bancos
  plaid.ts / finance.ts       Cliente de Plaid y normalización de datos
  demo.ts                     Generador de datos de demostración
  agent.ts                    Agente: prompt, herramientas y bucle de tool use
  store.ts                    Persistencia en .data/store.json (cifrado de tokens)
```

### El agente (Finn)

`lib/agent.ts` implementa un bucle de *tool use* en streaming con el modelo `claude-opus-5-5`
(razonamiento adaptativo, esfuerzo `medium`). Herramientas:

- `listar_cuentas`: saldos, patrimonio neto y categorías disponibles.
- `buscar_movimientos`: filtra por fechas, categoría, texto, cuenta o tipo.
- `resumen_por_periodo`: agrega gastos o ingresos por categoría, mes o comercio.

Las entradas de las herramientas se validan con Zod. Está activado el *fallback* del lado del servidor
(`fallbacks: "default"`), así que si el modelo rechaza una petición, la API la reintenta con otro
modelo. El historial completo (incluidos los bloques de razonamiento y de herramientas) se devuelve
al navegador y se reenvía tal cual en el siguiente turno.

## Antes de producción

- Sustituye `.data/store.json` por una base de datos y guarda la clave de cifrado en un KMS.
- Implementa los webhooks de Plaid (`SYNC_UPDATES_AVAILABLE`) y guarda el cursor de `transactions/sync`
  en lugar de descargar los movimientos en cada petición.
- Guarda el historial del chat en el servidor en vez de enviarlo desde el cliente, y añade límites de uso.
- Para usar Plaid en producción en España hace falta solicitar acceso a producción en el dashboard de Plaid.
