import { authorizeAdminApi } from "@/lib/admin-auth";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { opportunityTypeDefinition } from "@/lib/opportunity-types";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const auth = await authorizeAdminApi("OPPORTUNITIES_VIEW");
    if (!auth.authorized) return auth.error;
    const rows = await prisma.opportunity.findMany({
      select: {
        id: true,
        slug: true,
        title: true,
        type: true,
        lifecycle: true,
        publisherType: true,
        applicationDeadline: true,
        publicationBlockedAt: true,
        createdAt: true,
        publisherOrganization: { select: { id: true, publicName: true } },
        // Counts only. Private application content never appears in an admin
        // list view.
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return Response.json({
      items: rows.map((row) => ({
        ...row,
        typeLabel: opportunityTypeDefinition(row.type).label,
        applicationCount: row._count.applications,
        _count: undefined,
      })),
    });
  } catch (error) {
    return opportunityApiFailure("admin.opportunities.list", error);
  }
}
