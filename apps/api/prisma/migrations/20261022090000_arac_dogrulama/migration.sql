-- Araç doğrulaması: firma onayı için ruhsat + önden/yandan/arkadan fotoğraflı onaylı araç.
-- Vehicle tablosu daha önce hiç kullanılmadı; yeni zorunlu sütun yine de varsayılanla eklenip varsayılanı kaldırılır.

-- AlterTable
ALTER TABLE `Vehicle` MODIFY `plate` VARCHAR(12) NOT NULL,
    MODIFY `capacityM3` INTEGER NULL,
    ADD COLUMN `authorization` ENUM('K3', 'L1') NOT NULL DEFAULT 'K3',
    ADD COLUMN `status` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `reviewNote` VARCHAR(500) NULL,
    ADD COLUMN `reviewedAt` DATETIME(3) NULL;

ALTER TABLE `Vehicle` ALTER COLUMN `authorization` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `Vehicle_plate_idx` ON `Vehicle`(`plate`);

-- CreateIndex
CREATE INDEX `Vehicle_status_idx` ON `Vehicle`(`status`);

-- CreateTable
CREATE TABLE `VehicleFile` (
    `id` VARCHAR(191) NOT NULL,
    `vehicleId` VARCHAR(191) NOT NULL,
    `kind` ENUM('REGISTRATION', 'FRONT', 'SIDE', 'REAR') NOT NULL,
    `storageKey` VARCHAR(300) NOT NULL,
    `storage` ENUM('LOCAL', 'R2') NOT NULL DEFAULT 'LOCAL',
    `mimeType` VARCHAR(100) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `fileName` VARCHAR(200) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `VehicleFile_storageKey_key`(`storageKey`),
    INDEX `VehicleFile_storage_idx`(`storage`),
    UNIQUE INDEX `VehicleFile_vehicleId_kind_key`(`vehicleId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VehicleFile` ADD CONSTRAINT `VehicleFile_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
