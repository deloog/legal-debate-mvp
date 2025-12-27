/*
  Warnings:

  - A unique constraint covering the columns `[lawName,articleNumber]` on the table `law_articles` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "law_articles_lawName_articleNumber_key" ON "law_articles"("lawName", "articleNumber");
