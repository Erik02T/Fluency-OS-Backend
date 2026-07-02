/*
  Warnings:

  - The `position` column on the `radicals` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "kanji_radicals" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "kanjis" ADD COLUMN     "romanization" TEXT,
ADD COLUMN     "unicodeCodepoint" TEXT;

-- AlterTable
ALTER TABLE "radicals" DROP COLUMN "position",
ADD COLUMN     "position" INTEGER;
