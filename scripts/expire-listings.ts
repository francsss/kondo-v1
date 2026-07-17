import { expireMarketplaceListings } from "../src/lib/marketplace";
import { prisma } from "../src/lib/prisma";

async function main() {
  const result = await expireMarketplaceListings();
  console.log(JSON.stringify(result));
}

main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
