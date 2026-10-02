-- Firma belgeleri: fileUrl yerine depo anahtarı (firmalar/<firmaId>/...), dosya bilgileri ve geçerlilik tarihi.
-- Tabloya bugüne kadar hiç veri yazılmadı (yükleme ucu yoktu), NOT NULL sütunlar güvenle eklenir.
-- AlterTable
ALTER TABLE `CompanyDocument` DROP COLUMN `fileUrl`,
    ADD COLUMN `fileName` VARCHAR(200) NOT NULL,
    ADD COLUMN `mimeType` VARCHAR(100) NOT NULL,
    ADD COLUMN `sizeBytes` INTEGER NOT NULL,
    ADD COLUMN `storageKey` VARCHAR(300) NOT NULL,
    ADD COLUMN `validUntil` DATE NULL;

-- CreateIndex
CREATE UNIQUE INDEX `CompanyDocument_storageKey_key` ON `CompanyDocument`(`storageKey`);

-- CreateIndex
CREATE INDEX `CompanyDocument_companyId_type_idx` ON `CompanyDocument`(`companyId`, `type`);

