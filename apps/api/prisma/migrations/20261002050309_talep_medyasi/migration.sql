-- Kullanılmayan RequestPhoto tablosu (hiç veri yazılmadı) yerine fotoğraf ve videoyu birlikte tutan RequestMedia.

/*
  Warnings:

  - You are about to drop the `RequestPhoto` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `RequestPhoto` DROP FOREIGN KEY `RequestPhoto_requestId_fkey`;

-- DropTable
DROP TABLE `RequestPhoto`;

-- CreateTable
CREATE TABLE `RequestMedia` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `type` ENUM('PHOTO', 'VIDEO') NOT NULL,
    `storageKey` VARCHAR(300) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `durationSec` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RequestMedia_storageKey_key`(`storageKey`),
    INDEX `RequestMedia_requestId_idx`(`requestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RequestMedia` ADD CONSTRAINT `RequestMedia_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `MovingRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
