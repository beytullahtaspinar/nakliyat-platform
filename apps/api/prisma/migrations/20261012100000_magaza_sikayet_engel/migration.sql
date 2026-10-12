-- AlterTable
ALTER TABLE `UserIdentity` ADD COLUMN `revokeToken` TEXT NULL;

-- CreateTable
CREATE TABLE `MessagingBlock` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `blockedBy` ENUM('CUSTOMER', 'COMPANY', 'ADMIN') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MessagingBlock_companyId_idx`(`companyId`),
    UNIQUE INDEX `MessagingBlock_customerId_companyId_blockedBy_key`(`customerId`, `companyId`, `blockedBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContentReport` (
    `id` VARCHAR(191) NOT NULL,
    `reporterId` VARCHAR(191) NOT NULL,
    `target` ENUM('MESSAGE', 'REVIEW', 'REVIEW_REPLY') NOT NULL,
    `targetId` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NULL,
    `authorId` VARCHAR(191) NULL,
    `content` TEXT NOT NULL,
    `reason` ENUM('SPAM', 'ABUSE', 'INAPPROPRIATE', 'FRAUD', 'OTHER') NOT NULL,
    `note` VARCHAR(500) NULL,
    `status` ENUM('OPEN', 'RESOLVED', 'DISMISSED') NOT NULL DEFAULT 'OPEN',
    `resolution` VARCHAR(500) NULL,
    `resolvedById` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ContentReport_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `ContentReport_target_targetId_idx`(`target`, `targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
