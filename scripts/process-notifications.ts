import { processNotificationJobs } from "../src/lib/notifications";
import { prisma } from "../src/lib/prisma";
import { generateSmartNotificationJobs } from "../src/lib/smart-notifications";

const limit = Number(process.argv[2] ?? 100);

try {
  const generated = await generateSmartNotificationJobs();
  const processed = await processNotificationJobs(limit);
  console.log(
    JSON.stringify({
      event: "notifications.processed",
      generated,
      processed,
    }),
  );
} finally {
  await prisma.$disconnect();
}
