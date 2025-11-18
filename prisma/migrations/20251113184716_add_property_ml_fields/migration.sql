/*
  Warnings:

  - Added the required column `updatedAt` to the `Property` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "ageYears" DOUBLE PRECISION,
ADD COLUMN     "amenitiesCount" INTEGER,
ADD COLUMN     "balconies" INTEGER,
ADD COLUMN     "bathrooms" INTEGER,
ADD COLUMN     "bhk" INTEGER,
ADD COLUMN     "buildingType" TEXT,
ADD COLUMN     "builtUpAreaSqft" DOUBLE PRECISION,
ADD COLUMN     "carpetAreaSqft" DOUBLE PRECISION,
ADD COLUMN     "facing" TEXT,
ADD COLUMN     "floor" INTEGER,
ADD COLUMN     "furnishing" TEXT,
ADD COLUMN     "isReraRegistered" BOOLEAN,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "locality" TEXT,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "parking" TEXT,
ADD COLUMN     "predictedAt" TIMESTAMP(3),
ADD COLUMN     "propertyType" TEXT,
ADD COLUMN     "reraId" TEXT,
ADD COLUMN     "superBuiltUpAreaSqft" DOUBLE PRECISION,
ADD COLUMN     "totalFloors" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "yearBuilt" INTEGER;
