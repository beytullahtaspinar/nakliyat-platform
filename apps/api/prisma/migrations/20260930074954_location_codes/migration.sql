/*
  Warnings:

  - You are about to drop the column `city` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `serviceCities` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `fromCity` on the `MovingRequest` table. All the data in the column will be lost.
  - You are about to drop the column `toCity` on the `MovingRequest` table. All the data in the column will be lost.
  - Added the required column `cityCode` to the `Company` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fromCityCode` to the `MovingRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `toCityCode` to the `MovingRequest` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Company_city_idx";

-- DropIndex
DROP INDEX "MovingRequest_status_fromCity_idx";

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "city",
DROP COLUMN "serviceCities",
ADD COLUMN     "cityCode" CHAR(2) NOT NULL,
ADD COLUMN     "serviceCityCodes" TEXT[];

-- AlterTable
ALTER TABLE "MovingRequest" DROP COLUMN "fromCity",
DROP COLUMN "toCity",
ADD COLUMN     "fromCityCode" CHAR(2) NOT NULL,
ADD COLUMN     "toCityCode" CHAR(2) NOT NULL;

-- CreateIndex
CREATE INDEX "Company_cityCode_idx" ON "Company"("cityCode");

-- CreateIndex
CREATE INDEX "MovingRequest_status_fromCityCode_idx" ON "MovingRequest"("status", "fromCityCode");

-- CreateIndex
CREATE INDEX "MovingRequest_status_toCityCode_idx" ON "MovingRequest"("status", "toCityCode");
