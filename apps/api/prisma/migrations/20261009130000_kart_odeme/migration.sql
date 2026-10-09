-- AlterTable
ALTER TABLE `CreditTransaction` MODIFY `type` ENUM('QUOTE', 'QUOTE_REFUND', 'ADMIN_CREDIT', 'ADMIN_DEBIT', 'WELCOME', 'TRANSFER_TOPUP', 'CARD_TOPUP') NOT NULL;

-- CreateTable
CREATE TABLE `CardPayment` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `provider` VARCHAR(20) NOT NULL DEFAULT 'IYZICO',
    `token` VARCHAR(191) NULL,
    `amountTry` DECIMAL(12, 2) NOT NULL,
    `credits` INTEGER NOT NULL,
    `creditValueTry` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `sandbox` BOOLEAN NOT NULL DEFAULT false,
    `providerPaymentId` VARCHAR(64) NULL,
    `errorMessage` VARCHAR(500) NULL,
    `transactionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    UNIQUE INDEX `CardPayment_token_key`(`token`),
    UNIQUE INDEX `CardPayment_transactionId_key`(`transactionId`),
    INDEX `CardPayment_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `CardPayment_companyId_createdAt_idx`(`companyId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CardPayment` ADD CONSTRAINT `CardPayment_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardPayment` ADD CONSTRAINT `CardPayment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardPayment` ADD CONSTRAINT `CardPayment_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `CreditTransaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

