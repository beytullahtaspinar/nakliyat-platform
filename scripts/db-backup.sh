#!/usr/bin/env bash
# Sunucuda (cPanel) çalışır: veritabanının sıkıştırılmış yedeğini alır ve eski yedekleri temizler.
#
#   ~/db-backup.sh                 yedek al (cron ile her gece)
#   ~/db-backup.sh --etiket X      dosya adına etiket ekle (deploy öncesi yedeklerde sürüm adı)
#
# Bağlantı bilgisi ~/.config/nakliyat/db.env dosyasından okunur (bir kez oluşturulur, izni 600):
#   DATABASE_URL=mysql://kullanici:sifre@localhost:3306/veritabani
# Yedekler: ~/yedekler/veritabani/ (public_html dışında, web'den erişilemez)
# Geri yükleme: ~/db-restore.sh <dosya>. Ayrıntılar: docs/yedekleme.md
set -euo pipefail

CONFIG_DIR="$HOME/.config/nakliyat"
DB_ENV="${DB_ENV:-$CONFIG_DIR/db.env}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/yedekler/veritabani}"
KEEP_DAYS="${KEEP_DAYS:-14}"
MIN_KEEP="${MIN_KEEP:-5}"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [yedek] $*"; }
die() { log "HATA: $*"; exit 1; }

LABEL=""
if [ "${1:-}" = "--etiket" ]; then
  LABEL="$(printf '%s' "${2:-}" | tr -c 'A-Za-z0-9_-' '-')"
fi

[ -r "$DB_ENV" ] || die "$DB_ENV yok. Kurulum: docs/yedekleme.md"
DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' "$DB_ENV" | tail -1 | tr -d '\r' | sed "s/^[\"']//; s/[\"']$//")"
[ -n "$DATABASE_URL" ] || die "$DB_ENV içinde DATABASE_URL yok."

# mysql://kullanici:sifre@sunucu:port/veritabani?parametreler
rest="${DATABASE_URL#*://}"
creds="${rest%%@*}"
hostpart="${rest#*@}"
DB_USER="${creds%%:*}"
DB_PASS="${creds#*:}"
hostport="${hostpart%%/*}"
DB_NAME="${hostpart#*/}"
DB_NAME="${DB_NAME%%\?*}"
DB_HOST="${hostport%%:*}"
DB_PORT=3306
[ "$hostport" != "$DB_HOST" ] && DB_PORT="${hostport##*:}"
# URL kodlu karakterleri çöz (%40 -> @)
DB_PASS="$(printf '%b' "${DB_PASS//%/\\x}")"
[ -n "$DB_USER" ] && [ -n "$DB_NAME" ] || die "DATABASE_URL okunamadı."

DUMP="$(command -v mariadb-dump || command -v mysqldump || true)"
[ -n "$DUMP" ] || die "mysqldump bulunamadı."

# Şifre komut satırında görünmesin diye geçici, yalnızca bize açık bir ayar dosyası
umask 077
mkdir -p "$CONFIG_DIR" "$BACKUP_DIR"
CNF="$(mktemp "$CONFIG_DIR/.yedek-XXXXXX.cnf")"
trap 'rm -f "$CNF" "${PART:-}"' EXIT
printf '[client]\nuser=%s\npassword="%s"\nhost=%s\nport=%s\n' "$DB_USER" "${DB_PASS//\"/\\\"}" "$DB_HOST" "$DB_PORT" > "$CNF"

STAMP="$(date '+%Y%m%d-%H%M%S')"
FILE="$BACKUP_DIR/${DB_NAME}-${STAMP}${LABEL:+-$LABEL}.sql.gz"
PART="$FILE.part"

# --single-transaction: tabloları kilitlemeden tutarlı anlık görüntü (InnoDB)
# --no-tablespaces: paylaşımlı hostingde PROCESS yetkisi olmadığı için gerekli
"$DUMP" --defaults-extra-file="$CNF" \
  --single-transaction --quick --no-tablespaces --triggers \
  --default-character-set=utf8mb4 --hex-blob \
  "$DB_NAME" | gzip -6 > "$PART"

# Yarım kalmış yedeği "başarılı" saymamak için: arşiv sağlam mı, döküm sonuna kadar yazılmış mı?
gzip -t "$PART" || die "Yedek arşivi bozuk."
gzip -dc "$PART" | tail -n 1 | grep -q "Dump completed" || die "Döküm yarım kalmış."
mv "$PART" "$FILE"
PART=""
log "Yedek alındı: $FILE ($(du -h "$FILE" | cut -f1))"

# Eski yedekleri temizle: KEEP_DAYS günden eskileri sil ama en yeni MIN_KEEP yedeğe dokunma.
# (CageFS'te /dev/fd olmadığı için süreç ikamesi değil, boru kullanılıyor.)
i=0
ls -1t "$BACKUP_DIR"/*.sql.gz | while IFS= read -r f; do
  i=$((i + 1))
  [ "$i" -le "$MIN_KEEP" ] && continue
  if [ -n "$(find "$f" -mtime +"$KEEP_DAYS")" ]; then
    rm -f "$f" && log "Eski yedek silindi: ${f##*/}"
  fi
done
