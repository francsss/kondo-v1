import { z } from "zod";
import { MEET_INTENTS, MEET_LANGUAGE_OPTIONS } from "@/features/meet/config";

const intentValues = MEET_INTENTS.map(([value]) => value) as [
  (typeof MEET_INTENTS)[number][0],
  ...(typeof MEET_INTENTS)[number][0][],
];
const languageValues = MEET_LANGUAGE_OPTIONS as unknown as [
  (typeof MEET_LANGUAGE_OPTIONS)[number],
  ...(typeof MEET_LANGUAGE_OPTIONS)[number][],
];

export const meetIntentSchema = z.enum(intentValues);
export const meetLanguageSchema = z.enum(languageValues);

export const meetDiscoveryProfileSchema = z
  .object({
    gender: z.enum(["MALE", "FEMALE"]),
    interestedIn: z.enum(["ALL", "MALE", "FEMALE"]).default("ALL"),
    birthYear: z.coerce
      .number()
      .int()
      .min(1940)
      .max(new Date().getUTCFullYear() - 18)
      .nullable()
      .optional(),
    minimumAge: z.coerce.number().int().min(18).max(80).default(18),
    maximumAge: z.coerce.number().int().min(18).max(80).default(40),
    preferredLanguages: z.array(meetLanguageSchema).max(10).default([]),
    discoveryCityId: z
      .string()
      .cuid("Choose the city where you want to discover students."),
    discoveryUniversityId: z
      .string()
      .cuid("Choose your university for campus-area discovery."),
    lookingFor: z
      .array(meetIntentSchema)
      .min(1, "Choose at least one reason for using Meet.")
      .max(MEET_INTENTS.length)
      .default(MEET_INTENTS.map(([value]) => value)),
    distanceRange: z
      .enum(["KM_5", "KM_10", "KM_20", "CITY", "OTHER_CITY"])
      .default("CITY"),
    otherCityId: z.string().cuid().nullable().optional(),
    nearbyVisibility: z.boolean().default(true),
    showAge: z.boolean().default(true),
    showNationality: z.boolean().default(true),
    showUniversity: z.boolean().default(true),
    showRelationshipStatus: z.boolean().default(true),
    showLanguages: z.boolean().default(true),
    showInterests: z.boolean().default(true),
  })
  .refine((profile) => profile.minimumAge <= profile.maximumAge, {
    message:
      "The maximum age must be greater than or equal to the minimum age.",
    path: ["maximumAge"],
  })
  .refine(
    (profile) =>
      profile.distanceRange !== "OTHER_CITY" || Boolean(profile.otherCityId),
    {
      message: "Choose a city for cross-city discovery.",
      path: ["otherCityId"],
    },
  );

export const meetDiscoveryRequestSchema = z.object({
  mode: z.enum(["NEARBY", "LOOKING_FOR"]),
  genderPreference: z.enum(["ALL", "MALE", "FEMALE"]).default("ALL"),
  countryPreferenceCode: z.string().trim().toUpperCase().default(""),
  intents: z.array(meetIntentSchema).max(MEET_INTENTS.length).default([]),
  distanceRange: z
    .enum(["KM_5", "KM_10", "KM_20", "CITY", "OTHER_CITY"])
    .default("CITY"),
  nearbyRadiusMeters: z
    .union([
      z.literal(100),
      z.literal(300),
      z.literal(500),
      z.literal(1000),
      z.literal(2000),
      z.literal(5000),
    ])
    .default(500),
  otherCityId: z.string().cuid().nullable().optional(),
});

export type MeetDiscoveryProfileInput = z.infer<
  typeof meetDiscoveryProfileSchema
>;
