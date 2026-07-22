import { StudentHubShell } from "@/components/features/student-hub/StudentHubShell";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function StudentHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <StudentHubShell
      user={{ firstName: user.firstName, lastName: user.lastName }}
    >
      {children}
    </StudentHubShell>
  );
}
