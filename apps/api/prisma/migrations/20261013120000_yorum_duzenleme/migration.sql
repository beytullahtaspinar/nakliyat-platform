-- AlterTable
ALTER TABLE `Review` ADD COLUMN `editedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Review_isPublished_createdAt_idx` ON `Review`(`isPublished`, `createdAt`);
