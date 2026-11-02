-- Firma profilini oluşturmayan firma hesaplarına kayıt hatırlatması

-- AlterTable
ALTER TABLE `User` ADD COLUMN `onboardingReminderStep` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `onboardingRemindedAt` DATETIME(3) NULL;
