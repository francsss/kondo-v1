import { closeExpiredCommunityRequests } from "../src/lib/community-requests";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log(JSON.stringify(await closeExpiredCommunityRequests()));
}

main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
