import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Schedule" };

export default async function TimetableResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ generated?: string }>;
}) {
  const user = await requireUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const schedule = await prisma.studentSchedule.findFirst({
    where: { id, ownerId: user.id, isActive: true },
    select: { id: true },
  });
  if (!schedule) notFound();
  redirect(
    `/student-hub/tools?view=schedule&schedule=${schedule.id}${
      query.generated === "1" ? "&generated=1" : ""
    }`,
  );
}
