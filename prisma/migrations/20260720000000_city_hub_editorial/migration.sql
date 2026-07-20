-- CreateEnum
CREATE TYPE "CityHubStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED');

-- CreateTable
CREATE TABLE "CityHub" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CityHubStatus" NOT NULL DEFAULT 'DRAFT',
    "draft" JSONB NOT NULL,
    "published" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityHub_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CityHub_slug_key" ON "CityHub"("slug");

-- CreateIndex
CREATE INDEX "CityHub_status_updatedAt_idx" ON "CityHub"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "CityHub" ADD CONSTRAINT "CityHub_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityHub" ADD CONSTRAINT "CityHub_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
