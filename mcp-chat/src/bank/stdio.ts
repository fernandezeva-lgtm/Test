// Entrada stdio: permite usar el servidor Finora en Claude Desktop, VS Code, etc.
//   { "command": "npx", "args": ["tsx", "/ruta/mcp-chat/src/bank/stdio.ts"] }
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createBankServer } from "./server.ts";

serveStdio(() => createBankServer());
