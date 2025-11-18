/*
  Warnings:

  - You are about to drop the column `locality` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `predictedAt` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Property` table. All the data in the column will be lost.
  - You are about to alter the column `ageYears` on the `Property` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `builtUpAreaSqft` on the `Property` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `carpetAreaSqft` on the `Property` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `superBuiltUpAreaSqft` on the `Property` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.

*/
-- AlterTable
ALTER TABLE "Property" DROP COLUMN "locality",
DROP COLUMN "predictedAt",
DROP COLUMN "updatedAt",
ALTER COLUMN "city" DROP NOT NULL,
ALTER COLUMN "country" DROP NOT NULL,
ALTER COLUMN "ageYears" SET DATA TYPE INTEGER,
ALTER COLUMN "bathrooms" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "builtUpAreaSqft" SET DATA TYPE INTEGER,
ALTER COLUMN "carpetAreaSqft" SET DATA TYPE INTEGER,
ALTER COLUMN "isReraRegistered" SET DEFAULT false,
ALTER COLUMN "superBuiltUpAreaSqft" SET DATA TYPE INTEGER;
