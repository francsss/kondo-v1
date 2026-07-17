import { processNotificationJobs } from "../src/lib/notifications";
import { prisma } from "../src/lib/prisma";

const limit = Number(process.argv[2] ?? 100);

try {
  const result = await processNotificationJobs(limit);
  console.log(JSON.stringify({ event: "notifications.processed", ...result }));
} finally {
  await prisma.$disconnect();
}
