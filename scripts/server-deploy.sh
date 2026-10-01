#!/usr/bin/env bash
# Sunucuda (cPanel) çalışır: GitHub'daki en son "Canlı sürüm paketi"ni indirir ve kurar.
# cPanel Cron Jobs ile birkaç dakikada bir çalıştırılır; yeni sürüm yoksa hiçbir şey yapmaz.
#
#   ~/deploy.sh                      yeni sürüm varsa kur
#   ~/deploy.sh --force              en son sürümü yeniden kur (atlanan sürüm işaretlerini de kaldırır)
#   ~/deploy.sh --rollback           bir önceki sürüme dön; şimdiki sürüm yeni bir sürüm çıkana kadar atlanır
#   ~/deploy.sh --from-file X.tar.gz elle yüklenmiş paketi kur (GitHub'a erişilemezse)
#
# Güvenlik ağı:
#   - Kurulumdan önce veritabanı yedeği alınır (~/db-backup.sh ve ~/.config/nakliyat/db.env varsa).
#   - Kurulumdan sonra API ve web sağlık kontrolünden geçmezse otomatik olarak önceki sürüme dönülür
#     ve bozuk sürüm atlanır. Not: veritabanı migration'ları geri alınmaz; gerekirse yedekten dönülür.
#
# Gerekenler: ~/.config/nakliyat/github-token (yalnızca bu repo için "Contents: read" izinli token)
# ve cPanel'de kurulmuş Node.js uygulamaları. Ayrıntılar: docs/deployment-cpanel.md
set -euo pipefail

REPO="${REPO:-beytullahtaspinar/nakliyat-platform}"
GITHUB_API="${GITHUB_API:-https://api.github.com}"
API_DIR="${API_DIR:-nakliyat-api}"
WEB_DIR="${WEB_DIR:-nakliyat-web}"
NODE_MAJOR="${NODE_MAJOR:-22}"
API_HEALTH_URL="${API_HEALTH_URL-https://api.evdenevenakliyat.app/v1/health}"
WEB_HEALTH_URL="${WEB_HEALTH_URL-https://evdenevenakliyat.app/api/saglik}"
HEALTH_TRIES="${HEALTH_TRIES:-6}"
HEALTH_WAIT="${HEALTH_WAIT:-10}"

CONFIG_DIR="$HOME/.config/nakliyat"
TOKEN_FILE="$CONFIG_DIR/github-token"
STATE_FILE="$CONFIG_DIR/current-release"
SKIP_FILE="$CONFIG_DIR/skip-release"
DB_ENV="$CONFIG_DIR/db.env"
BACKUP_SCRIPT="$HOME/db-backup.sh"
WORK="$HOME/.nakliyat-deploy"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

mkdir -p "$CONFIG_DIR"
exec 9>"$CONFIG_DIR/deploy.lock"
flock -n 9 || { log "Başka bir kurulum sürüyor, çıkılıyor."; exit 0; }

# Log dosyaları 2 GB diski doldurmasın: sınırı aşanın son kısmı tutulur.
# Yerinde kısaltılır (cat >), çünkü cron ve Passenger dosyayı açık tutup sonuna yazıyor.
trim_log() {
  local file="$1" max="${2:-5242880}" keep="${3:-1048576}"
  [ -f "$file" ] || return 0
  if [ "$(wc -c < "$file")" -gt "$max" ]; then
    tail -c "$keep" "$file" > "$file.kisa" && cat "$file.kisa" > "$file" && rm -f "$file.kisa"
  fi
}
trim_log "$HOME/deploy.log"
trim_log "$HOME/yedek.log"
for f in "$HOME/$API_DIR"/*.log "$HOME/$WEB_DIR"/*.log; do trim_log "$f" 20971520 5242880; done

MODE="${1:-}"
CURRENT="$(cat "$STATE_FILE" 2>/dev/null || true)"
is_skipped() { [ -f "$SKIP_FILE" ] && grep -qxF "$1" "$SKIP_FILE"; }

if [ "$MODE" != "--from-file" ]; then
  [ -s "$TOKEN_FILE" ] || { log "HATA: $TOKEN_FILE yok veya boş."; exit 1; }
  # Web Terminal'de yapıştırırken eklenebilen görünmez karakterleri (bracketed paste) temizle
  TOKEN="$(sed 's/\x1b\[20[01]~//g' "$TOKEN_FILE" | tr -d '[:space:]')"
  NODE_BIN="$(command -v node || echo "$HOME/nodevenv/$API_DIR/$NODE_MAJOR/bin/node")"
fi

gh_api() { curl -fsSL --retry 3 -H "Authorization: Bearer $TOKEN" -H "X-GitHub-Api-Version: 2022-11-28" "$@"; }

# JSON'u sunucudaki Node ile ayrıştırır (jq kurulu olmayabilir).
# Not: CloudLinux CageFS'te /dev/fd yok, bu yüzden süreç ikamesi (<(...)) kullanılmıyor.
# $1: "latest" veya sürüm etiketi -> "etiket asset_id"
release_info() {
  local path="releases/latest"
  [ "$1" != "latest" ] && path="releases/tags/$1"
  gh_api -H "Accept: application/vnd.github+json" "$GITHUB_API/repos/$REPO/$path" | "$NODE_BIN" -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const r = JSON.parse(s);
      const a = (r.assets || []).find((x) => x.name === "release.tar.gz");
      if (!a) { console.error("Sürümde release.tar.gz yok"); process.exit(1); }
      console.log(r.tag_name, a.id);
    });'
}

# $1: etiket -> GitHub'da ondan bir önceki (daha eski) yayınlanmış sürümün etiketi
previous_tag() {
  gh_api -H "Accept: application/vnd.github+json" "$GITHUB_API/repos/$REPO/releases?per_page=30" | "$NODE_BIN" -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const list = JSON.parse(s)
        .filter((r) => !r.draft && (r.assets || []).some((a) => a.name === "release.tar.gz"))
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      const i = list.findIndex((r) => r.tag_name === process.argv[1]);
      const prev = i >= 0 ? list[i + 1] : undefined;
      if (prev) console.log(prev.tag_name);
    });' "$1"
}

# $1: etiket -> paketi $WORK altına indirip açar
download() {
  local parsed asset
  parsed="$(release_info "$1")"
  asset="${parsed##* }"
  rm -rf "$WORK" && mkdir -p "$WORK"
  gh_api -H "Accept: application/octet-stream" -o "$WORK/release.tar.gz" \
    "$GITHUB_API/repos/$REPO/releases/assets/$asset"
  tar -xzf "$WORK/release.tar.gz" -C "$WORK"
  rm -f "$WORK/release.tar.gz"
}

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

# $1: etiket. $WORK altındaki paketi kurar.
install_release() {
  install_app api "$API_DIR"
  install_app web "$WEB_DIR"
  echo "$1" > "$STATE_FILE"
  log "$1 kuruldu."
}

# Sunucudaki yardımcı betikleri paketteki sürümle güncelle (yalnızca sağlıklı ileri kurulumdan sonra)
update_scripts() {
  local name
  for name in server-deploy.sh:deploy.sh db-backup.sh:db-backup.sh db-restore.sh:db-restore.sh; do
    if [ -f "$WORK/${name%%:*}" ]; then
      cp "$WORK/${name%%:*}" "$HOME/${name##*:}.new" && chmod +x "$HOME/${name##*:}.new" \
        && mv "$HOME/${name##*:}.new" "$HOME/${name##*:}"
    fi
  done
}

# $1: adres, $2: beklenen sürüm (boşsa yalnızca "status":"ok" aranır)
check_url() {
  local body
  body="$(curl -fsS --max-time 120 "$1" 2>/dev/null)" || return 1
  printf '%s' "$body" | grep -q '"status":"ok"' || return 1
  [ -z "$2" ] || printf '%s' "$body" | grep -q "\"release\":\"$2\""
}

# $1: beklenen sürüm (boş olabilir). API ilk istekte açılır ve migration'ları o sırada uygular.
smoke_test() {
  local url ok
  for url in "$API_HEALTH_URL" "$WEB_HEALTH_URL"; do
    [ -n "$url" ] || continue
    ok=""
    for _ in $(seq "$HEALTH_TRIES"); do
      if check_url "$url" "$1"; then ok=1; break; fi
      sleep "$HEALTH_WAIT"
    done
    if [ -z "$ok" ]; then
      log "Sağlık kontrolü başarısız: $url${1:+ (beklenen sürüm $1)}"
      return 1
    fi
  done
  log "Sağlık kontrolü başarılı."
}

backup_before() {
  if [ -x "$BACKUP_SCRIPT" ] && [ -f "$DB_ENV" ]; then
    "$BACKUP_SCRIPT" --etiket "oncesi-$1" || { log "HATA: Yedek alınamadı, kurulum yapılmadı."; exit 1; }
  else
    log "UYARI: Veritabanı yedeği ayarlanmamış (docs/yedekleme.md), yedeksiz kuruluyor."
  fi
}

case "$MODE" in
  --from-file)
    ARCHIVE="${2:?Paket dosyasının yolunu ver}"
    TAG="elle-$(date +%Y%m%d%H%M%S)"
    rm -rf "$WORK" && mkdir -p "$WORK"
    tar -xzf "$ARCHIVE" -C "$WORK"
    ;;
  --rollback)
    [ -n "$CURRENT" ] || { log "HATA: Kurulu sürüm bilinmiyor."; exit 1; }
    TAG="$(previous_tag "$CURRENT")"
    [ -n "$TAG" ] || { log "HATA: $CURRENT sürümünden önceki bir sürüm GitHub'da yok."; exit 1; }
    log "Geri alınıyor: $CURRENT -> $TAG ($CURRENT, daha yeni bir sürüm çıkana kadar kurulmayacak)"
    echo "$CURRENT" >> "$SKIP_FILE"
    download "$TAG"
    ;;
  ""|--force)
    PARSED="$(release_info latest)"
    TAG="${PARSED%% *}"
    if [ "$MODE" = "--force" ]; then
      rm -f "$SKIP_FILE"
    elif [ "$TAG" = "$CURRENT" ] || is_skipped "$TAG"; then
      exit 0
    fi
    log "$TAG indiriliyor (kurulu: ${CURRENT:-yok})"
    download "$TAG"
    ;;
  *)
    echo "Bilinmeyen seçenek: $MODE"; exit 2 ;;
esac

# Paketteki RELEASE dosyası varsa sağlık kontrolü yeni sürümün gerçekten açıldığını doğrular
EXPECTED="$(cat "$WORK/api/RELEASE" 2>/dev/null || true)"

backup_before "$TAG"
install_release "$TAG"

if smoke_test "$EXPECTED"; then
  # Geri almada betikler eski sürüme düşürülmez
  [ "$MODE" = "--rollback" ] || update_scripts
  rm -rf "$WORK"
  exit 0
fi

# Yeni sürüm sağlıksız: önceki sürüme otomatik dön (elle geri almada ya da ilk kurulumda değil)
if [ "$MODE" = "--rollback" ] || [ "$MODE" = "--from-file" ] || [ -z "$CURRENT" ]; then
  log "HATA: Kurulum sonrası kontrol başarısız. cPanel > Setup Node.js App ekranındaki log dosyasına bak."
  exit 1
fi

log "HATA: $TAG sağlıksız, $CURRENT sürümüne geri dönülüyor. $TAG daha yeni bir sürüm çıkana kadar kurulmayacak."
echo "$TAG" >> "$SKIP_FILE"
download "$CURRENT"
install_release "$CURRENT"
rm -rf "$WORK"
smoke_test "" || log "UYARI: $CURRENT da sağlık kontrolünden geçmedi; sorun sürümde değil, sunucuda olabilir."
log "Not: $TAG ile gelen veritabanı migration'ları geri alınmadı. Gerekirse: ~/db-restore.sh (yedek: oncesi-$TAG)"
exit 1
