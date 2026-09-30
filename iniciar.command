#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Instala Node.js 22 o posterior desde https://nodejs.org/en/download y vuelve a abrir este archivo."
  if [ "$(uname -s)" = "Darwin" ]; then open "https://nodejs.org/en/download"; fi
  exit 1
fi
exec node abrir.mjs
