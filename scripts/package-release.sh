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

# Migration motoru (schema-engine) platforma özeldir. PRISMA_CLI_BINARY_TARGETS verilmişse
# (ör. sunucu için rhel-openssl-*), pnpm önbelleğinden gelen kopyaya o motorları da indir.
if [ -n "${PRISMA_CLI_BINARY_TARGETS:-}" ]; then
  ENGINES_DIR="$(cd "$OUT/api" && node -p "require('path').dirname(require.resolve('@prisma/engines/package.json', { paths: [require.resolve('prisma/package.json')] }))")"
  (cd "$ENGINES_DIR" && node scripts/postinstall.js)
  ls "$ENGINES_DIR" | grep schema-engine
fi

# Web: Next.js standalone çıktısı + statik dosyalar
cp -r apps/web/.next/standalone "$OUT/web"

# Standalone çıktısı pnpm'in sembolik bağlantılı düzenini kullanır. Sunucudaki LiteSpeed Node
# çalıştırıcısı bağlantıları her zaman çözmediği için paketler birbirini bulamıyor
# (ör. next -> @swc/helpers). Bağımlılıkları bağlantısız, düz bir node_modules'a açıyoruz.
WEB_MODS="$OUT/web/node_modules"
FLAT="$OUT/web/node_modules.flat"
mkdir -p "$FLAT"
for pkg in "$WEB_MODS"/.pnpm/*/node_modules/*; do
  [ -e "$pkg" ] || continue
  name="${pkg##*/}"
  if [[ "$name" == @* ]]; then
    # Kapsamlı paketler (@swc/helpers gibi) bir alt klasördedir
    for sub in "$pkg"/*; do
      rel="$name/${sub##*/}"
      if [ -e "$sub" ] && [ ! -e "$FLAT/$rel" ]; then
        mkdir -p "$FLAT/$name"
        cp -rL "$sub" "$FLAT/$rel"
      fi
    done
  elif [ ! -e "$FLAT/$name" ]; then
    cp -rL "$pkg" "$FLAT/$name"
  fi
done
rm -rf "$WEB_MODS" "$OUT/web/apps/web/node_modules"
mv "$FLAT" "$WEB_MODS"
if find "$WEB_MODS" -type l | grep -q .; then
  echo "HATA: web node_modules içinde hâlâ sembolik bağlantı var" >&2
  exit 1
fi

mkdir -p "$OUT/web/apps/web/.next"
cp -r apps/web/.next/static "$OUT/web/apps/web/.next/static"
if [ -d apps/web/public ]; then
  cp -r apps/web/public "$OUT/web/apps/web/public"
fi

echo "Paketler hazır: $OUT/api ve $OUT/web"
