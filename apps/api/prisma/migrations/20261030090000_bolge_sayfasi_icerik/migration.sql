-- Bölge sayfalarının yönetimden düzenlenen içeriği (başlık, açıklama, giriş, kapak, ek içerik, SSS)

-- CreateTable
CREATE TABLE `LocalPageContent` (
    `slug` VARCHAR(200) NOT NULL,
    `seoTitle` VARCHAR(200) NULL,
    `seoDescription` VARCHAR(400) NULL,
    `heading` VARCHAR(200) NULL,
    `intro` TEXT NULL,
    `content` MEDIUMTEXT NULL,
    `faq` JSON NULL,
    `coverKey` VARCHAR(300) NULL,
    `coverAlt` VARCHAR(200) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`slug`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
