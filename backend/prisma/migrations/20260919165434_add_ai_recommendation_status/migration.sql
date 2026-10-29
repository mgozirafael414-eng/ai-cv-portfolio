/*
  Warnings:

  - Added the required column `updated_at` to the `ai_generations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ai_generations" ADD COLUMN     "edited_text" TEXT,
ADD COLUMN     "status" VARCHAR(40) NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "target_id" VARCHAR(80),
ADD COLUMN     "target_type" VARCHAR(80),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "ai_generations_user_id_status_idx" ON "ai_generations"("user_id", "status");
