/**
 * The assistant's action list, kept separate from `study-assistant.ts`.
 *
 * The reader is a client component and needs these labels; the assistant
 * module imports the Anthropic SDK and reads the API key, so it must never be
 * reachable from the browser bundle. Splitting the list is what keeps that
 * boundary honest rather than incidental.
 */
export const STUDY_ASSISTANT_ACTIONS = [
  {
    key: "explain",
    label: "Explain this",
    hint: "A plain-language explanation of the passage.",
  },
  {
    key: "summarize",
    label: "Summarize",
    hint: "The passage reduced to its essential points.",
  },
  {
    key: "quiz",
    label: "Revision questions",
    hint: "Questions to test whether you have understood it.",
  },
  {
    key: "notes",
    label: "Turn into notes",
    hint: "Structured study notes you can keep.",
  },
  /*
   * Added for the book reader. A student reading a textbook in a second
   * language asks different things of a passage than one revising their own
   * course notes: what does this actually say, and why does it matter.
   */
  {
    key: "translate",
    label: "Translate",
    hint: "The passage in your own language, kept faithful.",
  },
  {
    key: "simplify",
    label: "Explain simply",
    hint: "The same meaning in the plainest words possible.",
  },
  {
    key: "significance",
    label: "Why does this matter?",
    hint: "What the passage is doing in the wider argument.",
  },
] as const;

export type StudyAssistantAction =
  (typeof STUDY_ASSISTANT_ACTIONS)[number]["key"];

export function isStudyAssistantAction(
  value: string,
): value is StudyAssistantAction {
  return STUDY_ASSISTANT_ACTIONS.some((action) => action.key === value);
}
