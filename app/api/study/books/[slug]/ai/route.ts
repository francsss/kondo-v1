import { NextRequest } from "next/server";
import { z } from "zod";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/server-auth";
import { STUDY_ASSISTANT_ACTIONS } from "@/lib/study-assistant-actions";
import { askBookAssistant } from "@/lib/study-book-assistant";
import { StudyEssentialError } from "@/lib/study-essentials";
import { requireReadableTitle } from "@/lib/study-reading";

/**
 * Ask Kondo AI about a passage.
 *
 * Three gates before a single token is spent: the member is signed in, they
 * are entitled to the title, and the title's licence permits AI processing.
 * The third is the one that will matter with real textbooks — a publisher may
 * license reading and forbid machine processing, and `aiAllowed` is how that
 * is honoured rather than assumed.
 */

export const dynamic = "force-dynamic";

/** The canned prompts, so the client sends a key rather than a prompt. */
const PROMPTS: Record<string, string> = {
  explain: "Explain this passage in plain language.",
  translate: "Translate this passage for me.",
  simplify: "Explain this as simply as you can.",
  significance: "Why does this passage matter?",
  summarize: "Summarize this passage.",
  quiz: "Write a few revision questions about this passage.",
  notes: "Turn this passage into study notes.",
};

const schema = z.object({
  selectedText: z.string().trim().min(1).max(4000),
  locator: z.string().trim().max(600).optional().nullable(),
  chapter: z.string().trim().max(300).optional().nullable(),
  context: z.string().trim().max(2000).optional().nullable(),
  action: z
    .enum(
      STUDY_ASSISTANT_ACTIONS.map((entry) => entry.key) as [
        string,
        ...string[],
      ],
    )
    .optional(),
  question: z.string().trim().max(500).optional(),
});

type Context = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  // Model calls cost money and time; a reader asking thirty questions a minute
  // is a loop, not a student.
  const limit = await rateLimit(`books:ai:${user.id}`, 20, 5 * 60_000);
  if (!limit.allowed) {
    return jsonError("You are asking very quickly. Give it a moment.", 429);
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request.");
  }
  const question =
    parsed.data.question?.trim() ||
    (parsed.data.action ? PROMPTS[parsed.data.action] : undefined);
  if (!question) return jsonError("Choose an action or ask a question.");

  const { slug } = await params;
  try {
    // Entitlement first: an unowned book must not reach the model at all,
    // because doing so would let anyone extract passages they cannot read.
    const essential = await requireReadableTitle(user.id, slug);
    if (!essential.aiAllowed) {
      return jsonError(
        "This title's licence does not allow AI assistance.",
        403,
      );
    }

    const result = await askBookAssistant({
      bookTitle: essential.title,
      chapter: parsed.data.chapter,
      passage: parsed.data.selectedText,
      context: parsed.data.context,
      question,
      language: null,
    });

    return Response.json(
      { ...result, locator: parsed.data.locator ?? null },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    if (error instanceof StudyEssentialError)
      return jsonError(error.message, error.status);
    return internalApiError("study.book-ai", error);
  }
}
