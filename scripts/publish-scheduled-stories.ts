import { prisma } from "../src/lib/prisma";
import { publishScheduledStories } from "../src/lib/stories";

async function main() {
  console.log(JSON.stringify(await publishScheduledStories()));
}

main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
