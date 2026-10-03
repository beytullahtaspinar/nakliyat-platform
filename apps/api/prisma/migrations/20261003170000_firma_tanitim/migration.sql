-- AlterTable: firma tanıtım sayfası alanları
ALTER TABLE `Company`
    ADD COLUMN `services` JSON NULL,
    ADD COLUMN `foundedYear` SMALLINT NULL,
    ADD COLUMN `fleetSize` SMALLINT NULL,
    ADD COLUMN `staffSize` SMALLINT NULL,
    ADD COLUMN `showcaseComplete` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: firma logo ve fotoğrafları
CREATE TABLE `CompanyMedia` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `kind` ENUM('LOGO', 'PHOTO') NOT NULL,
    `storageKey` VARCHAR(300) NOT NULL,
    `storage` ENUM('LOCAL', 'R2') NOT NULL DEFAULT 'LOCAL',
    `thumbKey` VARCHAR(300) NULL,
    `thumbStorage` ENUM('LOCAL', 'R2') NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `caption` VARCHAR(120) NULL,
    `hiddenAt` DATETIME(3) NULL,
    `hiddenReason` VARCHAR(300) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CompanyMedia_storageKey_key`(`storageKey`),
    UNIQUE INDEX `CompanyMedia_thumbKey_key`(`thumbKey`),
    INDEX `CompanyMedia_companyId_kind_idx`(`companyId`, `kind`),
    INDEX `CompanyMedia_storage_idx`(`storage`),
    INDEX `CompanyMedia_thumbStorage_idx`(`thumbStorage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CompanyMedia` ADD CONSTRAINT `CompanyMedia_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
