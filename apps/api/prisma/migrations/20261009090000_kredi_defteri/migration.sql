-- Kredi defteri (Faz 1): firma bakiyesi, değiştirilemez hareket kaydı, tek satırlık ayarlar; teklifte düşülen kredi
-- AlterTable
ALTER TABLE `Quote` ADD COLUMN `creditCost` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `creditRefundedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `CreditAccount` (
    `companyId` VARCHAR(191) NOT NULL,
    `balance` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `type` ENUM('QUOTE', 'QUOTE_REFUND', 'ADMIN_CREDIT', 'ADMIN_DEBIT', 'WELCOME') NOT NULL,
    `amount` INTEGER NOT NULL,
    `balanceAfter` INTEGER NOT NULL,
    `quoteId` VARCHAR(191) NULL,
    `requestId` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `actorId` VARCHAR(191) NULL,
    `note` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CreditTransaction_idempotencyKey_key`(`idempotencyKey`),
    INDEX `CreditTransaction_companyId_createdAt_idx`(`companyId`, `createdAt`),
    INDEX `CreditTransaction_type_createdAt_idx`(`type`, `createdAt`),
    INDEX `CreditTransaction_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditSettings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `settings` JSON NOT NULL,
    `updatedById` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CreditAccount` ADD CONSTRAINT `CreditAccount_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditTransaction` ADD CONSTRAINT `CreditTransaction_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditTransaction` ADD CONSTRAINT `CreditTransaction_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditTransaction` ADD CONSTRAINT `CreditTransaction_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `MovingRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditTransaction` ADD CONSTRAINT `CreditTransaction_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

