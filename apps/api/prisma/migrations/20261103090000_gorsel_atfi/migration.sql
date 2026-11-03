-- Lisanslı görsellerin atfı (fotoğrafçı, lisans, kaynak)
ALTER TABLE `BlogMedia`
  ADD COLUMN `creditAuthor` VARCHAR(200) NULL,
  ADD COLUMN `creditLicense` VARCHAR(100) NULL,
  ADD COLUMN `creditLicenseUrl` VARCHAR(300) NULL,
  ADD COLUMN `creditSourceUrl` VARCHAR(500) NULL;
