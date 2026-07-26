export const MEET_INTENTS = [
  ["FRIENDS", "Friends"],
  ["STUDY", "Study partner"],
  ["LANGUAGE", "Language exchange"],
  ["SPORTS", "Sports"],
  ["CITY", "Explore the city"],
  ["NETWORKING", "Networking"],
  ["COUNTRY", "Same country"],
  ["RELATIONSHIP", "Relationship"],
] as const;

export const MEET_LANGUAGE_OPTIONS = [
  "English",
  "French",
  "Arabic",
  "Portuguese",
  "Swahili",
  "Mandarin Chinese",
  "Spanish",
  "Hausa",
  "Amharic",
  "Yoruba",
  "Igbo",
  "Lingala",
  "Wolof",
  "Somali",
  "Afrikaans",
] as const;

export const MEET_DISTANCE_OPTIONS = [
  { value: "KM_5", label: "5 km", premium: false },
  { value: "KM_10", label: "10 km", premium: false },
  { value: "KM_20", label: "20 km", premium: true },
  { value: "CITY", label: "Entire city", premium: false },
  { value: "OTHER_CITY", label: "Another city", premium: true },
] as const;

export const MEET_PREMIUM_FEATURES = {
  FULL_PROFILES: "MEET_FULL_PROFILES",
  MAP_CONNECTIONS: "MEET_MAP_CONNECTIONS",
  EXTENDED_DISTANCE: "MEET_EXTENDED_DISTANCE",
  OTHER_CITY: "MEET_OTHER_CITY",
  ADVANCED_FILTERS: "MEET_ADVANCED_FILTERS",
} as const;

export type MeetPremiumFeature =
  (typeof MEET_PREMIUM_FEATURES)[keyof typeof MEET_PREMIUM_FEATURES];
