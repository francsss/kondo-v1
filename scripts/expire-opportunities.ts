import { expireOpportunities } from "@/lib/opportunity-management";

// Mirrors scripts/expire-listings.ts and scripts/expire-housing.ts so the
// opportunity deadline sweep can run from CI, cron or the internal route.
async function main() {
  const result = await expireOpportunities();
  console.log(`Expired ${result.expired} opportunity/opportunities.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
