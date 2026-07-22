import { QuestionDetailContent } from "../../../../(platform)/help/[slug]/page";

export default function StudentQuestionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <QuestionDetailContent backHref="/student-hub/help" params={params} />;
}
