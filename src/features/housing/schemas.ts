import { z } from "zod";
import {
  HousingFurnishing,
  HousingListingType,
  HousingLocationPrivacy,
  HousingPolicyPreference,
  HousingPublisherType,
  HousingRequestVisibility,
  RoommateProfileVisibility,
  UserGender,
} from "@prisma/client";
import {
  HOUSING_AMENITIES,
  PERSONAL_HOUSING_LISTING_TYPES,
} from "@/features/housing/registry";

const cuid = z.string().trim().min(10).max(40);
const money = z.coerce.number().int().min(0).max(100_000_000);
const optionalMoney = money.optional().nullable();
const date = z.coerce.date();
const optionalDate = date.optional().nullable();
const coordinate = z.coerce.number().min(-180).max(180);
const amenityKeys = HOUSING_AMENITIES.map(([key]) => key) as [
  string,
  ...string[],
];

export const housingListingInputSchema = z
  .object({
    publisherType: z.nativeEnum(HousingPublisherType),
    organizationId: cuid.optional().nullable(),
    type: z.nativeEnum(HousingListingType),
    title: z.string().trim().min(5).max(160),
    shortDescription: z.string().trim().min(10).max(320),
    description: z.string().trim().min(20).max(8_000),
    houseRules: z.string().trim().max(2_000).optional().nullable(),
    neighborhoodContext: z.string().trim().max(1_200).optional().nullable(),
    transportContext: z.string().trim().max(1_200).optional().nullable(),
    universityContext: z.string().trim().max(1_200).optional().nullable(),
    countryId: cuid,
    cityId: cuid,
    district: z.string().trim().max(160).optional().nullable(),
    universityId: cuid.optional().nullable(),
    publicLocationLabel: z.string().trim().min(2).max(240),
    privateAddress: z.string().trim().max(500).optional().nullable(),
    exactLatitude: coordinate.min(-90).max(90).optional().nullable(),
    exactLongitude: coordinate.optional().nullable(),
    locationPrivacy: z.nativeEnum(HousingLocationPrivacy),
    monthlyRentMinor: money,
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase()),
    depositMinor: optionalMoney,
    utilitiesMinor: optionalMoney,
    agencyFeeMinor: optionalMoney,
    serviceFeeMinor: optionalMoney,
    otherCostsDescription: z.string().trim().max(800).optional().nullable(),
    paymentPeriod: z.string().trim().max(80).optional().nullable(),
    negotiable: z.coerce.boolean().default(false),
    bedrooms: z.coerce.number().int().min(0).max(100).optional().nullable(),
    bathrooms: z.coerce.number().min(0).max(100).optional().nullable(),
    sizeSquareMeters: z.coerce
      .number()
      .min(1)
      .max(10_000)
      .optional()
      .nullable(),
    furnishing: z.nativeEnum(HousingFurnishing).default("UNKNOWN"),
    floor: z.string().trim().max(40).optional().nullable(),
    occupancy: z.coerce.number().int().min(0).max(100).optional().nullable(),
    availablePlaces: z.coerce.number().int().min(1).max(100).default(1),
    availableFrom: date,
    leaseEnd: optionalDate,
    minimumStayMonths: z.coerce
      .number()
      .int()
      .min(1)
      .max(120)
      .optional()
      .nullable(),
    maximumStayMonths: z.coerce
      .number()
      .int()
      .min(1)
      .max(120)
      .optional()
      .nullable(),
    smokingPolicy: z
      .nativeEnum(HousingPolicyPreference)
      .default("NOT_SPECIFIED"),
    petPolicy: z.nativeEnum(HousingPolicyPreference).default("NOT_SPECIFIED"),
    genderPreference: z.nativeEnum(UserGender).optional().nullable(),
    accessibilityDetails: z.string().trim().max(1_000).optional().nullable(),
    contactPreference: z
      .enum(["KONDO_MESSAGE", "PUBLIC_CHANNEL"])
      .default("KONDO_MESSAGE"),
    publicContactEnabled: z.coerce.boolean().default(false),
    amenities: z.array(z.enum(amenityKeys)).max(24).default([]),
    accuracyConfirmed: z.coerce.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (value.publisherType === "ORGANIZATION" && !value.organizationId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["organizationId"],
        message: "Choose the organization publishing this listing.",
      });
    }
    if (value.publisherType === "PERSONAL" && value.organizationId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["organizationId"],
        message: "Personal listings cannot use an organization publisher.",
      });
    }
    if (
      value.publisherType === "PERSONAL" &&
      !PERSONAL_HOUSING_LISTING_TYPES.includes(
        value.type as (typeof PERSONAL_HOUSING_LISTING_TYPES)[number],
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["type"],
        message: "This listing type requires an organization publisher.",
      });
    }
    if ((value.exactLatitude == null) !== (value.exactLongitude == null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exactLatitude"],
        message: "Latitude and longitude must be provided together.",
      });
    }
    if (
      value.locationPrivacy === "PUBLIC_EXACT_LOCATION" &&
      value.publisherType === "PERSONAL"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["locationPrivacy"],
        message: "Personal listings use privacy-safe public locations.",
      });
    }
    if (
      value.minimumStayMonths &&
      value.maximumStayMonths &&
      value.minimumStayMonths > value.maximumStayMonths
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maximumStayMonths"],
        message: "Maximum stay must be longer than minimum stay.",
      });
    }
  });

export const housingSearchSchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    cityId: cuid.optional(),
    district: z.string().trim().max(160).optional(),
    universityId: cuid.optional(),
    organizationId: cuid.optional(),
    types: z.array(z.nativeEnum(HousingListingType)).max(10).default([]),
    minimumRentMinor: money.optional(),
    maximumRentMinor: money.optional(),
    currency: z.string().trim().length(3).optional(),
    bedrooms: z.coerce.number().int().min(0).max(20).optional(),
    availableFrom: date.optional(),
    minimumStayMonths: z.coerce.number().int().min(1).max(120).optional(),
    furnished: z.coerce.boolean().optional(),
    amenities: z.array(z.enum(amenityKeys)).max(24).default([]),
    publisher: z
      .enum(["ALL", "ORGANIZATION", "VERIFIED_ORGANIZATION", "PERSONAL"])
      .default("ALL"),
    petPolicy: z.nativeEnum(HousingPolicyPreference).optional(),
    smokingPolicy: z.nativeEnum(HousingPolicyPreference).optional(),
    sort: z
      .enum(["RELEVANCE", "NEWEST", "PRICE_ASC", "PRICE_DESC", "AVAILABLE"])
      .default("RELEVANCE"),
    cursor: z.string().trim().max(240).optional(),
    limit: z.coerce.number().int().min(1).max(30).default(16),
  })
  .refine(
    (value) =>
      value.minimumRentMinor == null ||
      value.maximumRentMinor == null ||
      value.minimumRentMinor <= value.maximumRentMinor,
    { path: ["maximumRentMinor"], message: "Maximum rent is too low." },
  );

export const housingInquirySchema = z.object({
  topic: z.enum([
    "AVAILABILITY",
    "VIEWING",
    "UTILITIES",
    "LEASE_DURATION",
    "OTHER",
  ]),
  message: z.string().trim().min(2).max(1_500),
});

export const housingRequestInputSchema = z
  .object({
    cityId: cuid,
    preferredDistrict: z.string().trim().max(160).optional().nullable(),
    universityId: cuid.optional().nullable(),
    moveInDate: date,
    stayDurationMonths: z.coerce
      .number()
      .int()
      .min(1)
      .max(120)
      .optional()
      .nullable(),
    minimumBudgetMinor: optionalMoney,
    maximumBudgetMinor: money,
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase()),
    preferredListingTypes: z
      .array(z.nativeEnum(HousingListingType))
      .min(1)
      .max(10),
    roomPreference: z.string().trim().max(80).optional().nullable(),
    roommateOpen: z.coerce.boolean().default(false),
    requiredAmenities: z.array(z.enum(amenityKeys)).max(24).default([]),
    preferredCommute: z.string().trim().max(240).optional().nullable(),
    description: z.string().trim().min(20).max(1_200),
    contactPreference: z.enum(["KONDO_MESSAGE"]).default("KONDO_MESSAGE"),
    visibility: z.nativeEnum(HousingRequestVisibility).default("MEMBERS_ONLY"),
    expiresAt: date,
  })
  .refine(
    (value) =>
      value.minimumBudgetMinor == null ||
      value.minimumBudgetMinor <= value.maximumBudgetMinor,
    { path: ["maximumBudgetMinor"], message: "Maximum budget is too low." },
  );

export const roommateProfileInputSchema = z
  .object({
    active: z.coerce.boolean().default(true),
    visibility: z.nativeEnum(RoommateProfileVisibility).default("MEMBERS_ONLY"),
    cityId: cuid,
    universityId: cuid.optional().nullable(),
    moveInDate: date,
    stayDurationMonths: z.coerce
      .number()
      .int()
      .min(1)
      .max(120)
      .optional()
      .nullable(),
    budgetMinimumMinor: optionalMoney,
    budgetMaximumMinor: money,
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase()),
    preferredHousingTypes: z
      .array(z.nativeEnum(HousingListingType))
      .min(1)
      .max(10),
    currentHousingSituation: z.string().trim().max(160).optional().nullable(),
    languages: z.array(z.string().trim().min(2).max(60)).max(12).default([]),
    sleepSchedule: z.enum(["EARLY", "FLEXIBLE", "LATE"]).optional().nullable(),
    routine: z
      .enum(["MOSTLY_HOME", "BALANCED", "MOSTLY_AWAY"])
      .optional()
      .nullable(),
    cleanlinessPreference: z
      .enum(["RELAXED", "BALANCED", "VERY_TIDY"])
      .optional()
      .nullable(),
    cookingFrequency: z
      .enum(["RARELY", "SOMETIMES", "OFTEN"])
      .optional()
      .nullable(),
    smokingPreference: z
      .nativeEnum(HousingPolicyPreference)
      .default("NOT_SPECIFIED"),
    petPreference: z
      .nativeEnum(HousingPolicyPreference)
      .default("NOT_SPECIFIED"),
    guestPreference: z
      .enum(["RARE", "SOMETIMES", "SOCIAL"])
      .optional()
      .nullable(),
    noisePreference: z
      .enum(["QUIET", "BALANCED", "LIVELY"])
      .optional()
      .nullable(),
    genderPreference: z.nativeEnum(UserGender).optional().nullable(),
    introduction: z.string().trim().min(20).max(800),
    allowInterests: z.coerce.boolean().default(true),
    showUniversity: z.coerce.boolean().default(true),
    showApproximateLocation: z.coerce.boolean().default(true),
  })
  .refine(
    (value) =>
      value.budgetMinimumMinor == null ||
      value.budgetMinimumMinor <= value.budgetMaximumMinor,
    { path: ["budgetMaximumMinor"], message: "Maximum budget is too low." },
  );

export const roommateDiscoverySchema = z
  .object({
    cityId: cuid.optional(),
    universityId: cuid.optional(),
    moveInFrom: date.optional(),
    moveInTo: date.optional(),
    maximumBudgetMinor: money.optional(),
    languages: z.array(z.string().trim().min(2).max(60)).max(12).default([]),
    smokingPreference: z.nativeEnum(HousingPolicyPreference).optional(),
    petPreference: z.nativeEnum(HousingPolicyPreference).optional(),
    cursor: z.string().trim().max(240).optional(),
    limit: z.coerce.number().int().min(1).max(30).default(18),
  })
  .refine(
    (value) =>
      !value.moveInFrom ||
      !value.moveInTo ||
      value.moveInFrom <= value.moveInTo,
    { path: ["moveInTo"], message: "Move-in date range is invalid." },
  );

export const roommateInterestSchema = z.object({
  recipientUserId: cuid,
  message: z.string().trim().max(500).optional().nullable(),
});

export const housingReportSchema = z.object({
  reason: z.enum(["SPAM", "SCAM", "INAPPROPRIATE", "HARASSMENT", "OTHER"]),
  details: z.string().trim().max(1_000).optional().nullable(),
});
