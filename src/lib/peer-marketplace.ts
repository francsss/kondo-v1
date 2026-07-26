export const STUDENT_SKILL_CATEGORIES = [
  "Language practice",
  "Study support",
  "Design & creativity",
  "Coding & technology",
  "Career & CV",
  "Photography & video",
  "Music & performance",
  "Fitness & sports",
  "City orientation",
  "Practical life help",
] as const;

export type StudentSkillCategory = (typeof STUDENT_SKILL_CATEGORIES)[number];
