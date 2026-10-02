-- AlterTable
ALTER TABLE `User` ADD COLUMN `termsAcceptedAt` DATETIME(3) NULL,
    ADD COLUMN `termsVersion` VARCHAR(20) NULL,
    ADD COLUMN `marketingConsentAt` DATETIME(3) NULL;
