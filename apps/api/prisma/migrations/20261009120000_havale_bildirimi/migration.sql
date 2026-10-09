-- AlterTable
ALTER TABLE `CreditAccount` ADD COLUMN `transferCode` VARCHAR(20) NULL;

-- AlterTable
ALTER TABLE `CreditTransaction` MODIFY `type` ENUM('QUOTE', 'QUOTE_REFUND', 'ADMIN_CREDIT', 'ADMIN_DEBIT', 'WELCOME', 'TRANSFER_TOPUP') NOT NULL;

-- CreateTable
CREATE TABLE `BankTransfer` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `amountTry` DECIMAL(12, 2) NOT NULL,
    `senderName` VARCHAR(120) NOT NULL,
    `transferDate` DATE NOT NULL,
    `iban` VARCHAR(34) NOT NULL,
    `note` VARCHAR(500) NULL,
    `receiptKey` VARCHAR(300) NULL,
    `receiptStorage` ENUM('LOCAL', 'R2') NULL,
    `receiptMimeType` VARCHAR(100) NULL,
    `receiptSizeBytes` INTEGER NULL,
    `receiptFileName` VARCHAR(200) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `approvedAmountTry` DECIMAL(12, 2) NULL,
    `credits` INTEGER NULL,
    `creditValueTry` DECIMAL(10, 2) NULL,
    `rejectReason` VARCHAR(500) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `transactionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BankTransfer_receiptKey_key`(`receiptKey`),
    UNIQUE INDEX `BankTransfer_transactionId_key`(`transactionId`),
    INDEX `BankTransfer_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `BankTransfer_companyId_createdAt_idx`(`companyId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `CreditAccount_transferCode_key` ON `CreditAccount`(`transferCode`);

-- AddForeignKey
ALTER TABLE `BankTransfer` ADD CONSTRAINT `BankTransfer_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BankTransfer` ADD CONSTRAINT `BankTransfer_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BankTransfer` ADD CONSTRAINT `BankTransfer_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `CreditTransaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

