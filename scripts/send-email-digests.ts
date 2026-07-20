import { sendDueEmailDigests } from "../src/lib/email-digest";
import { prisma } from "../src/lib/prisma";

async function main() {
  const result = await sendDueEmailDigests();
  console.log(JSON.stringify(result));
}

main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
