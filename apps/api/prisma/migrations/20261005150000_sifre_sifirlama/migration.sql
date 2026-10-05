-- AlterTable
ALTER TABLE `VerificationCode` MODIFY `channel` ENUM('EMAIL', 'PHONE', 'PASSWORD_RESET') NOT NULL;
