#!/usr/bin/env bash
# Sunucuda (cPanel) çalışır: GitHub'daki en son "Canlı sürüm paketi"ni indirir ve kurar.
# cPanel Cron Jobs ile birkaç dakikada bir çalıştırılır; yeni sürüm yoksa hiçbir şey yapmaz.
#
#   ~/deploy.sh                      yeni sürüm varsa kur
#   ~/deploy.sh --force              en son sürümü yeniden kur
#   ~/deploy.sh --from-file X.tar.gz elle yüklenmiş paketi kur (GitHub'a erişilemezse)
#
# Gerekenler: ~/.config/nakliyat/github-token (yalnızca bu repo için "Contents: read" izinli token)
# ve cPanel'de kurulmuş Node.js uygulamaları. Ayrıntılar: docs/deployment-cpanel.md
set -euo pipefail

REPO="${REPO:-beytullahtaspinar/nakliyat-platform}"
API_DIR="${API_DIR:-nakliyat-api}"
WEB_DIR="${WEB_DIR:-nakliyat-web}"
NODE_MAJOR="${NODE_MAJOR:-22}"
API_HEALTH_URL="${API_HEALTH_URL-https://api.evdenevenakliyat.app/v1/health}"

CONFIG_DIR="$HOME/.config/nakliyat"
TOKEN_FILE="$CONFIG_DIR/github-token"
STATE_FILE="$CONFIG_DIR/current-release"
WORK="$HOME/.nakliyat-deploy"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

mkdir -p "$CONFIG_DIR"
exec 9>"$CONFIG_DIR/deploy.lock"
flock -n 9 || { log "Başka bir kurulum sürüyor, çıkılıyor."; exit 0; }

MODE="${1:-}"
TAG=""

if [ "$MODE" = "--from-file" ]; then
  ARCHIVE="${2:?Paket dosyasının yolunu ver}"
  TAG="elle-$(date +%Y%m%d%H%M%S)"
  rm -rf "$WORK" && mkdir -p "$WORK"
  tar -xzf "$ARCHIVE" -C "$WORK"
else
  [ -s "$TOKEN_FILE" ] || { log "HATA: $TOKEN_FILE yok veya boş."; exit 1; }
  # Web Terminal'de yapıştırırken eklenebilen görünmez karakterleri (bracketed paste) temizle
  TOKEN="$(sed 's/\x1b\[20[01]~//g' "$TOKEN_FILE" | tr -d '[:space:]')"
  gh_api() { curl -fsSL --retry 3 -H "Authorization: Bearer $TOKEN" -H "X-GitHub-Api-Version: 2022-11-28" "$@"; }

  RELEASE_JSON="$(gh_api -H "Accept: application/vnd.github+json" "https://api.github.com/repos/$REPO/releases/latest")"
  # JSON'u sunucudaki Node ile ayrıştır (jq kurulu olmayabilir)
  NODE_BIN="$(command -v node || echo "$HOME/nodevenv/$API_DIR/$NODE_MAJOR/bin/node")"
  # Not: CloudLinux CageFS'te /dev/fd yok, bu yüzden süreç ikamesi (<(...)) kullanılmıyor.
  PARSED="$(printf '%s' "$RELEASE_JSON" | "$NODE_BIN" -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const r = JSON.parse(s);
      const a = (r.assets || []).find((x) => x.name === "release.tar.gz");
      if (!a) { console.error("Sürümde release.tar.gz yok"); process.exit(1); }
      console.log(r.tag_name, a.id);
    });')"
  TAG="${PARSED%% *}"
  ASSET_ID="${PARSED##* }"

  CURRENT="$(cat "$STATE_FILE" 2>/dev/null || true)"
  if [ "$TAG" = "$CURRENT" ] && [ "$MODE" != "--force" ]; then
    exit 0
  fi

  log "$TAG indiriliyor (kurulu: ${CURRENT:-yok})"
  rm -rf "$WORK" && mkdir -p "$WORK"
  gh_api -H "Accept: application/octet-stream" -o "$WORK/release.tar.gz" \
    "https://api.github.com/repos/$REPO/releases/assets/$ASSET_ID"
  tar -xzf "$WORK/release.tar.gz" -C "$WORK"
  rm -f "$WORK/release.tar.gz"
fi

# $1: paketteki klasör (api/web), $2: cPanel uygulama klasörü
install_app() {
  local src="$WORK/$1" app="$HOME/$2"
  local venv="$HOME/nodevenv/$2/$NODE_MAJOR"
  local mods="$venv/lib/node_modules"

  if [ ! -d "$venv" ]; then
    log "UYARI: '$2' Node.js uygulaması cPanel'de yok, atlandı."
    return 0
  fi
  [ -d "$src" ] || { log "HATA: pakette $1 klasörü yok."; exit 1; }

  # Bağımlılıklar CloudLinux'un beklediği sanal ortama taşınır (kopyalamak yerine taşımak diski korur)
  mkdir -p "$venv/lib"
  rm -rf "$mods.old"
  if [ -e "$mods" ]; then mv "$mods" "$mods.old"; fi
  mv "$src/node_modules" "$mods"
  rm -rf "$mods.old"

  # Uygulama dosyalarını yenile; ortam ve log dosyalarına dokunma
  mkdir -p "$app"
  find "$app" -mindepth 1 -maxdepth 1 \
    ! -name node_modules ! -name tmp ! -name .env ! -name .htaccess ! -name '*.log' \
    -exec rm -rf {} +
  cp -a "$src/." "$app/"
  if [ ! -e "$app/node_modules" ]; then ln -s "$mods" "$app/node_modules"; fi

  mkdir -p "$app/tmp" && touch "$app/tmp/restart.txt"
  log "$2 güncellendi ve yeniden başlatılıyor."
}

install_app api "$API_DIR"
install_app web "$WEB_DIR"

# Betiğin kendisini de güncel tut
if [ -f "$WORK/server-deploy.sh" ]; then
  cp "$WORK/server-deploy.sh" "$HOME/deploy.sh.new" && chmod +x "$HOME/deploy.sh.new" && mv "$HOME/deploy.sh.new" "$HOME/deploy.sh"
fi

rm -rf "$WORK"
echo "$TAG" > "$STATE_FILE"
log "$TAG kuruldu."

# API ilk istekte açılır ve migration'ları o sırada uygular
if [ -n "$API_HEALTH_URL" ]; then
  ok=""
  for _ in 1 2 3 4 5 6; do
    if curl -fsS --max-time 120 "$API_HEALTH_URL"; then ok=1; echo; break; fi
    sleep 10
  done
  if [ -n "$ok" ]; then
    log "Sağlık kontrolü başarılı."
  else
    log "UYARI: Sağlık kontrolü başarısız. cPanel > Setup Node.js App ekranındaki log dosyasına bak."
  fi
fi
