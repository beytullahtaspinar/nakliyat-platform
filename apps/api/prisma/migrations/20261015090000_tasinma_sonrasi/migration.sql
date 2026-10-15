-- AlterTable
ALTER TABLE `Booking` ADD COLUMN `completionCheckSentAt` DATETIME(3) NULL,
    ADD COLUMN `completedBy` ENUM('CUSTOMER', 'COMPANY', 'SYSTEM', 'ADMIN') NULL,
    ADD COLUMN `disputedAt` DATETIME(3) NULL,
    ADD COLUMN `disputedBy` ENUM('CUSTOMER', 'COMPANY', 'SYSTEM', 'ADMIN') NULL,
    ADD COLUMN `disputeReason` TEXT NULL,
    ADD COLUMN `disputeResolvedAt` DATETIME(3) NULL,
    ADD COLUMN `disputeResolution` VARCHAR(500) NULL;

-- CreateIndex
CREATE INDEX `Booking_disputedAt_idx` ON `Booking`(`disputedAt`);
