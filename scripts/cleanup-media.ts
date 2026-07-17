import { cleanupMediaAssets } from "../src/lib/media";
import { prisma } from "../src/lib/prisma";

try {
  const result = await cleanupMediaAssets();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.failed > 0) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
