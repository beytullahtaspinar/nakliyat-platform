/*
  Warnings:

  - You are about to alter the column `type` on the `Notification` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(50)`.

*/
-- AlterTable
ALTER TABLE `Notification` ADD COLUMN `attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lastError` VARCHAR(500) NULL,
    ADD COLUMN `status` ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    MODIFY `channel` ENUM('IN_APP', 'SMS', 'EMAIL', 'PUSH') NOT NULL,
    MODIFY `type` VARCHAR(50) NOT NULL;

-- CreateTable
CREATE TABLE `NotificationPreference` (
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `channel` ENUM('IN_APP', 'SMS', 'EMAIL', 'PUSH') NOT NULL,
    `enabled` BOOLEAN NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`, `type`, `channel`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Notification_userId_channel_createdAt_idx` ON `Notification`(`userId`, `channel`, `createdAt`);

-- CreateIndex
CREATE INDEX `Notification_status_createdAt_idx` ON `Notification`(`status`, `createdAt`);

-- AddForeignKey
ALTER TABLE `NotificationPreference` ADD CONSTRAINT `NotificationPreference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
