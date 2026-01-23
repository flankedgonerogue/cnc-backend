/*
  Warnings:

  - You are about to drop the column `mainCharacter` on the `StoryTemplate` table. All the data in the column will be lost.
  - Added the required column `mainCharacter` to the `StoryTemplate` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "StoryTemplate" DROP COLUMN "mainCharacter",
ADD COLUMN     "mainCharacter" TEXT NOT NULL,
ADD COLUMN     "visualStyle" TEXT NOT NULL DEFAULT 'disney-pixar aesthetic';
