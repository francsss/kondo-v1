import { expireHousingListings } from "../src/lib/housing-listings";
import { expireHousingRequests } from "../src/lib/housing-requests";
import { prisma } from "../src/lib/prisma";

async function main() {
  const [listings, requests] = await Promise.all([
    expireHousingListings(),
    expireHousingRequests(),
  ]);
  console.log(JSON.stringify({ listings, requests }));
}

main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
