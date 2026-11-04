#!/bin/bash
# Doble clic en Mac para abrir MCP Chat (Banco Finora + widgets MCP Apps).
cd "$(dirname "$0")/mcp-chat" || exit 1
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.volta/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Necesitas instalar Node.js (versión LTS). Se abrirá la web de descarga."
  echo "Cuando termines de instalarlo, vuelve a hacer doble clic en este archivo."
  open "https://nodejs.org"
  read -n 1 -s -r -p "Pulsa una tecla para cerrar…"
  exit 1
fi

node scripts/launch.mjs
