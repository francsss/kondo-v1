import { GuideDetailContent } from "../../../../(platform)/guides/[slug]/page";

export default function StudentGuideDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <GuideDetailContent backHref="/student-hub" params={params} />;
}
