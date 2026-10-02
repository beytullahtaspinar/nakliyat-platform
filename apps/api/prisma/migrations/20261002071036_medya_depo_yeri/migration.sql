-- Dosyanın nerede durduğu (hibrit depolama). Mevcut kayıtlar sunucu diskinde: R2'ye yükleme şimdiye kadar hiç başarılı olmadı.
-- AlterTable
ALTER TABLE `RequestMedia` ADD COLUMN `storage` ENUM('LOCAL', 'R2') NOT NULL DEFAULT 'LOCAL';

-- CreateIndex
CREATE INDEX `RequestMedia_storage_idx` ON `RequestMedia`(`storage`);
