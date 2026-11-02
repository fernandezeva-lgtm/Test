// Crea .env.local con valores listos para probar la app en modo demo.
// Uso: npm run setup
import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const file = ".env.local";
if (existsSync(file)) {
  console.log(`\n${file} ya existe; no lo toco. Bórralo si quieres generarlo de nuevo.\n`);
  process.exit(0);
}

const secret = () => randomBytes(32).toString("base64");
writeFileSync(
  file,
  `# Generado por "npm run setup". Rellena lo que necesites.

AUTH_SECRET=${secret()}
TOKEN_ENCRYPTION_KEY=${secret()}

# Entrar sin Google (solo en local)
DEMO_LOGIN=true

# Opcional: login con Google
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
ALLOWED_EMAILS=

# Opcional: bancos reales con Plaid. Vacío = datos de demostración
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox

# Necesaria para hablar con el asistente Finn (https://console.anthropic.com)
ANTHROPIC_API_KEY=
`,
);

console.log(`
✔ Creado ${file}

Siguiente paso:
  npm run dev
y abre http://localhost:3000 → "Entrar en modo demo".

Para usar el asistente Finn, pega tu clave en ANTHROPIC_API_KEY dentro de ${file}
y vuelve a lanzar "npm run dev".
`);
