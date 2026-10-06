-- CreateTable: firma görünen ad değişikliği talepleri (yönetim onayına düşer)
CREATE TABLE `CompanyNameChange` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `oldName` VARCHAR(191) NOT NULL,
    `newName` VARCHAR(80) NOT NULL,
    `status` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewNote` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,

    INDEX `CompanyNameChange_companyId_status_idx`(`companyId`, `status`),
    INDEX `CompanyNameChange_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CompanyNameChange` ADD CONSTRAINT `CompanyNameChange_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
