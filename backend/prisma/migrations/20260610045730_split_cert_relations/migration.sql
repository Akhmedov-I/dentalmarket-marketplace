/*
  Warnings:

  - You are about to drop the column `holder_id` on the `certifications` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "certifications" DROP CONSTRAINT "fk_cert_product";

-- DropForeignKey
ALTER TABLE "certifications" DROP CONSTRAINT "fk_cert_seller";

-- DropIndex
DROP INDEX "idx_cert_holder";

-- AlterTable
ALTER TABLE "certifications" DROP COLUMN "holder_id",
ADD COLUMN     "product_id" UUID,
ADD COLUMN     "seller_profile_id" UUID;

-- CreateIndex
CREATE INDEX "idx_cert_seller_profile" ON "certifications"("seller_profile_id");

-- CreateIndex
CREATE INDEX "idx_cert_product" ON "certifications"("product_id");

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_seller_profile_id_fkey" FOREIGN KEY ("seller_profile_id") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
