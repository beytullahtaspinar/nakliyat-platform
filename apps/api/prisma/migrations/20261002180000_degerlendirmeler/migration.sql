-- AlterTable
ALTER TABLE `Review` ADD COLUMN `companyReplyAt` DATETIME(3) NULL,
    ADD COLUMN `hiddenAt` DATETIME(3) NULL,
    ADD COLUMN `hiddenReason` VARCHAR(500) NULL;

-- CreateIndex
CREATE INDEX `Review_companyId_isPublished_createdAt_idx` ON `Review`(`companyId`, `isPublished`, `createdAt`);
