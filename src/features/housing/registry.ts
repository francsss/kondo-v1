import type {
  HousingListingType,
  HousingPolicyPreference,
} from "@prisma/client";

export const HOUSING_LISTING_TYPES = [
  {
    key: "ENTIRE_APARTMENT",
    label: "Entire apartment",
    description: "A complete apartment for one household or group.",
    icon: "building",
    personalAllowed: false,
    organizationAllowed: true,
    roommatesRelevant: false,
    occupancyRequired: true,
    analyticsKey: "entire_apartment",
  },
  {
    key: "PRIVATE_ROOM",
    label: "Private room",
    description: "A private bedroom with shared or private common spaces.",
    icon: "door",
    personalAllowed: true,
    organizationAllowed: true,
    roommatesRelevant: true,
    occupancyRequired: true,
    analyticsKey: "private_room",
  },
  {
    key: "SHARED_ROOM",
    label: "Shared room",
    description: "A bedroom shared with one or more people.",
    icon: "users",
    personalAllowed: true,
    organizationAllowed: true,
    roommatesRelevant: true,
    occupancyRequired: true,
    analyticsKey: "shared_room",
  },
  {
    key: "STUDENT_RESIDENCE",
    label: "Student residence",
    description: "Purpose-built accommodation for students.",
    icon: "graduation-cap",
    personalAllowed: false,
    organizationAllowed: true,
    roommatesRelevant: false,
    occupancyRequired: true,
    analyticsKey: "student_residence",
  },
  {
    key: "UNIVERSITY_DORMITORY",
    label: "University dormitory",
    description: "Accommodation operated or authorized by a university.",
    icon: "school",
    personalAllowed: false,
    organizationAllowed: true,
    roommatesRelevant: true,
    occupancyRequired: true,
    analyticsKey: "university_dormitory",
  },
  {
    key: "STUDIO",
    label: "Studio",
    description: "A compact self-contained home.",
    icon: "home",
    personalAllowed: false,
    organizationAllowed: true,
    roommatesRelevant: false,
    occupancyRequired: false,
    analyticsKey: "studio",
  },
  {
    key: "HOUSE",
    label: "House",
    description: "A complete house offered as one home.",
    icon: "house",
    personalAllowed: false,
    organizationAllowed: true,
    roommatesRelevant: false,
    occupancyRequired: true,
    analyticsKey: "house",
  },
  {
    key: "ROOMMATE_REPLACEMENT",
    label: "Roommate replacement",
    description: "A place becoming available in an existing shared home.",
    icon: "user-plus",
    personalAllowed: true,
    organizationAllowed: false,
    roommatesRelevant: true,
    occupancyRequired: true,
    analyticsKey: "roommate_replacement",
  },
  {
    key: "SUBLET",
    label: "Sublet",
    description: "A time-limited stay offered by the current tenant.",
    icon: "calendar",
    personalAllowed: true,
    organizationAllowed: true,
    roommatesRelevant: true,
    occupancyRequired: false,
    analyticsKey: "sublet",
  },
  {
    key: "OTHER",
    label: "Other approved housing",
    description: "A housing format that does not fit the options above.",
    icon: "more-horizontal",
    personalAllowed: false,
    organizationAllowed: true,
    roommatesRelevant: false,
    occupancyRequired: false,
    analyticsKey: "other",
  },
] as const satisfies ReadonlyArray<{
  key: HousingListingType;
  label: string;
  description: string;
  icon: string;
  personalAllowed: boolean;
  organizationAllowed: boolean;
  roommatesRelevant: boolean;
  occupancyRequired: boolean;
  analyticsKey: string;
}>;

export const PERSONAL_HOUSING_LISTING_TYPES = HOUSING_LISTING_TYPES.filter(
  ({ personalAllowed }) => personalAllowed,
).map(({ key }) => key);

export const HOUSING_AMENITIES = [
  ["WIFI", "Wi-Fi"],
  ["AIR_CONDITIONING", "Air conditioning"],
  ["HEATING", "Heating"],
  ["WASHING_MACHINE", "Washing machine"],
  ["KITCHEN", "Kitchen"],
  ["ELEVATOR", "Elevator"],
  ["SECURITY", "Building security"],
  ["GYM", "Gym"],
  ["BALCONY", "Balcony"],
  ["PRIVATE_BATHROOM", "Private bathroom"],
  ["PUBLIC_TRANSPORT", "Near public transport"],
  ["CAMPUS_SHUTTLE", "Campus shuttle"],
] as const;

export type HousingAmenityKey = (typeof HOUSING_AMENITIES)[number][0];

export const HOUSING_POLICY_OPTIONS: ReadonlyArray<{
  key: HousingPolicyPreference;
  label: string;
}> = [
  { key: "ALLOWED", label: "Allowed" },
  { key: "NOT_ALLOWED", label: "Not allowed" },
  { key: "CASE_BY_CASE", label: "Ask the publisher" },
  { key: "NOT_SPECIFIED", label: "Not specified" },
];

export function housingListingTypeMetadata(key: HousingListingType) {
  return HOUSING_LISTING_TYPES.find((item) => item.key === key)!;
}

export function housingAmenityLabel(key: string) {
  return HOUSING_AMENITIES.find(([candidate]) => candidate === key)?.[1] ?? key;
}
