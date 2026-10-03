-- AlterTable
ALTER TABLE `Booking` ADD COLUMN `reminderSentAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Booking_companyId_scheduledAt_idx` ON `Booking`(`companyId`, `scheduledAt`);

-- CreateIndex
CREATE INDEX `Booking_status_scheduledAt_idx` ON `Booking`(`status`, `scheduledAt`);
