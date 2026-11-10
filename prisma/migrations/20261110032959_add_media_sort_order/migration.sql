-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Media_productId_sortOrder_idx" ON "Media"("productId", "sortOrder");
