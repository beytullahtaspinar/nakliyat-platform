-- AlterTable: talebin firmalara açıldığı an (hızlı yanıt rozeti için)
ALTER TABLE `MovingRequest` ADD COLUMN `publishedAt` DATETIME(3) NULL;

-- Eski talepler: taslak olmayanlar oluşturuldukları an yayına girmiş sayılır
UPDATE `MovingRequest` SET `publishedAt` = `createdAt` WHERE `status` <> 'DRAFT';
