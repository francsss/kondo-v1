-- CreateEnum
CREATE TYPE "CommunityRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "CommunityRequestPriority" AS ENUM ('URGENT', 'IMPORTANT', 'NORMAL');

-- CreateEnum
CREATE TYPE "CommunityRequestCategory" AS ENUM ('ACADEMIC', 'HOUSING', 'TRANSPORT', 'DOCUMENTS', 'HEALTH', 'OTHER');

-- CreateTable
CREATE TABLE "CommunityRequest" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "category" "CommunityRequestCategory" NOT NULL,
    "priority" "CommunityRequestPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "CommunityRequestStatus" NOT NULL DEFAULT 'OPEN',
    "title" VARCHAR(140) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityRequestHelpOffer" (
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityRequestHelpOffer_pkey" PRIMARY KEY ("requestId","userId")
);

-- CreateIndex
CREATE INDEX "CommunityRequest_communityId_status_expiresAt_idx" ON "CommunityRequest"("communityId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "CommunityRequest_communityId_priority_status_expiresAt_idx" ON "CommunityRequest"("communityId", "priority", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "CommunityRequest_creatorId_createdAt_idx" ON "CommunityRequest"("creatorId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityRequestHelpOffer_userId_createdAt_idx" ON "CommunityRequestHelpOffer"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CommunityRequest" ADD CONSTRAINT "CommunityRequest_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityRequest" ADD CONSTRAINT "CommunityRequest_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityRequestHelpOffer" ADD CONSTRAINT "CommunityRequestHelpOffer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CommunityRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityRequestHelpOffer" ADD CONSTRAINT "CommunityRequestHelpOffer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
