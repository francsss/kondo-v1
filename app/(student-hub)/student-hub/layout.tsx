import { StudentHubShell } from "@/components/features/student-hub/StudentHubShell";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function StudentHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return <StudentHubShell>{children}</StudentHubShell>;
}
