#!/usr/bin/env bash
# cPanel'e yüklenecek, bağımlılıkları içinde hazır paketleri out/ altına üretir.
#   out/api  -> API (başlangıç dosyası: app.cjs)
#   out/web  -> Web (başlangıç dosyası: apps/web/server.js)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/out"
cd "$ROOT"

rm -rf "$OUT"
mkdir -p "$OUT"

pnpm build

# API: sadece üretim bağımlılıklarıyla bağımsız klasör
pnpm --filter @nakliyat/api deploy --prod "$OUT/api"

# Web: Next.js standalone çıktısı + statik dosyalar
cp -r apps/web/.next/standalone "$OUT/web"
mkdir -p "$OUT/web/apps/web/.next"
cp -r apps/web/.next/static "$OUT/web/apps/web/.next/static"
if [ -d apps/web/public ]; then
  cp -r apps/web/public "$OUT/web/apps/web/public"
fi

echo "Paketler hazır: $OUT/api ve $OUT/web"
