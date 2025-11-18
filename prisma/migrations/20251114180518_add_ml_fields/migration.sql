/*
  Warnings:

  - You are about to drop the column `builtUpAreaSqft` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `carpetAreaSqft` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `isReraRegistered` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `reraId` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `superBuiltUpAreaSqft` on the `Property` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Property" DROP COLUMN "builtUpAreaSqft",
DROP COLUMN "carpetAreaSqft",
DROP COLUMN "isReraRegistered",
DROP COLUMN "reraId",
DROP COLUMN "superBuiltUpAreaSqft",
ADD COLUMN     "builtup_area_sqft" DOUBLE PRECISION,
ADD COLUMN     "carpet_area_sqft" DOUBLE PRECISION,
ADD COLUMN     "is_rera_registered" BOOLEAN,
ADD COLUMN     "listing_id" TEXT,
ADD COLUMN     "locality" TEXT,
ADD COLUMN     "rera_id" TEXT,
ADD COLUMN     "super_builtup_area_sqft" DOUBLE PRECISION,
ALTER COLUMN "features" DROP NOT NULL;
