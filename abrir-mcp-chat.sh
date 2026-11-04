#!/bin/bash
# Linux: ./abrir-mcp-chat.sh  (o doble clic → "Ejecutar en terminal")
cd "$(dirname "$0")/mcp-chat" || exit 1
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
if ! command -v node >/dev/null 2>&1; then
  echo "Necesitas Node.js 20 o superior: https://nodejs.org"
  xdg-open "https://nodejs.org" >/dev/null 2>&1
  exit 1
fi
node scripts/launch.mjs
