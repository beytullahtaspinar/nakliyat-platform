-- Dosyanın nerede durduğu (hibrit depolama: R2, olmazsa sunucu diski). Mevcut kayıtlar sunucu diskinde:
-- R2'ye yükleme şimdiye kadar hiç başarılı olmadı.

-- AlterTable
ALTER TABLE `RequestMedia` ADD COLUMN `storage` ENUM('LOCAL', 'R2') NOT NULL DEFAULT 'LOCAL';

-- AlterTable
ALTER TABLE `CompanyDocument` ADD COLUMN `storage` ENUM('LOCAL', 'R2') NOT NULL DEFAULT 'LOCAL';

-- CreateIndex
CREATE INDEX `RequestMedia_storage_idx` ON `RequestMedia`(`storage`);

-- CreateIndex
CREATE INDEX `CompanyDocument_storage_idx` ON `CompanyDocument`(`storage`);
