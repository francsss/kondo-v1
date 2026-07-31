import { processOpportunityReminders } from "@/lib/opportunity-reminders";
import { prisma } from "@/lib/prisma";

try {
  console.log(await processOpportunityReminders());
} finally {
  await prisma.$disconnect();
}
