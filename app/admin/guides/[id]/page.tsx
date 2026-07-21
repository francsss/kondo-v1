import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { GuideEditForm } from "@/components/features/admin/GuideEditForm";
import { GuidePublishActions } from "@/components/features/admin/GuidePublishActions";
import { GuideStepManager } from "@/components/features/admin/GuideStepManager";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAdminGuide } from "@/lib/guides";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin guide review" };

export default async function AdminGuideDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdminPermission("GUIDE_CMS_VIEW");
  const guide = await getAdminGuide(user, (await params).id);
  if (!guide) notFound();

  return (
    <div className="mx-auto max-w-[1040px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Button asChild size="sm" variant="ghost">
        <Link href="/admin/guides">
          <ArrowLeft className="h-4 w-4" /> Guides
        </Link>
      </Button>
      <div className="mt-4">
        <PageHeader
          description={`Created by ${guide.createdBy.firstName} ${guide.createdBy.lastName} · ${guide.slug}`}
          eyebrow="Kondo operations"
          title={guide.title}
        />
      </div>
      <AdminNav currentPath="/admin/guides" role={user.role} />
      <div className="mt-7 space-y-6">
        <GuidePublishActions
          guideId={guide.id}
          published={guide.published}
          stepCount={guide.steps.length}
        />
        <GuideEditForm
          guideId={guide.id}
          initial={{
            title: guide.title,
            summary: guide.summary,
            category: guide.category,
            estimatedMinutes: guide.estimatedMinutes,
            featured: guide.featured,
            coverMediaId: guide.coverMediaId,
          }}
        />
        <GuideStepManager guideId={guide.id} steps={guide.steps} />
      </div>
    </div>
  );
}
