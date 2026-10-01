#!/usr/bin/env bash
# Sunucuda (cPanel Terminal) elle çalıştırılır: bir yedeği veritabanına geri yükler.
#
#   ~/db-restore.sh                        mevcut yedekleri listeler
#   ~/db-restore.sh ~/yedekler/veritabani/<dosya>.sql.gz
#
# Geri yüklemeden önce o anki veritabanının da yedeği alınır; yanlış dosya seçilirse geri dönülebilir.
# Ayrıntılar: docs/yedekleme.md
set -euo pipefail

CONFIG_DIR="$HOME/.config/nakliyat"
DB_ENV="${DB_ENV:-$CONFIG_DIR/db.env}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/yedekler/veritabani}"
BACKUP_SCRIPT="${BACKUP_SCRIPT:-$HOME/db-backup.sh}"

if [ -z "${1:-}" ]; then
  echo "Kullanım: $0 <yedek-dosyası>"
  echo "Mevcut yedekler (en yeni üstte):"
  ls -1th "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "  (yedek yok)"
  exit 1
fi

FILE="$1"
[ -r "$FILE" ] || { echo "HATA: $FILE okunamıyor."; exit 1; }
gzip -t "$FILE" || { echo "HATA: $FILE bozuk."; exit 1; }

DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' "$DB_ENV" | tail -1 | tr -d '\r' | sed "s/^[\"']//; s/[\"']$//")"
rest="${DATABASE_URL#*://}"; creds="${rest%%@*}"; hostpart="${rest#*@}"
DB_USER="${creds%%:*}"
DB_PASS="$(printf '%b' "$(printf '%s' "${creds#*:}" | sed 's/%/\\x/g')")"
hostport="${hostpart%%/*}"; DB_NAME="${hostpart#*/}"; DB_NAME="${DB_NAME%%\?*}"
DB_HOST="${hostport%%:*}"; DB_PORT=3306; [ "$hostport" != "$DB_HOST" ] && DB_PORT="${hostport##*:}"

echo "DİKKAT: '$DB_NAME' veritabanındaki tüm veriler şu yedekle DEĞİŞTİRİLECEK:"
echo "  $FILE"
if [ "${ONAY:-}" != "EVET" ]; then
  read -r -p "Devam etmek için büyük harflerle EVET yaz: " answer
  [ "$answer" = "EVET" ] || { echo "Vazgeçildi."; exit 1; }
fi

echo "Önce mevcut durumun yedeği alınıyor..."
"$BACKUP_SCRIPT" --etiket geri-yukleme-oncesi

MYSQL="$(command -v mariadb || command -v mysql)"
umask 077
CNF="$(mktemp "$CONFIG_DIR/.geri-XXXXXX.cnf")"
trap 'rm -f "$CNF"' EXIT
printf '[client]\nuser=%s\npassword="%s"\nhost=%s\nport=%s\n' "$DB_USER" "${DB_PASS//\"/\\\"}" "$DB_HOST" "$DB_PORT" > "$CNF"

gzip -dc "$FILE" | "$MYSQL" --defaults-extra-file="$CNF" --default-character-set=utf8mb4 "$DB_NAME"
echo "Geri yükleme tamamlandı. API'yi yeniden başlatmak için: touch ~/nakliyat-api/tmp/restart.txt"
