/**
 * The shape a discovered student takes on the client.
 *
 * This used to live inside `MeetDiscoveryMap`, which is why every consumer —
 * the carousel, the Looking For list, the panel — imported it from a map
 * component none of them rendered. The map is gone; the shape it happened to
 * declare is not, so it lives here where the surfaces that use it can find it.
 */
export type MeetDiscoveryProfile = {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string;
  avatarMediaId: string | null;
  bio: string | null;
  gender: "MALE" | "FEMALE" | null;
  age: number | null;
  lastActiveAt: string | null;
  /** A whole-kilometre distance between study points, never a device position. */
  distanceLabel: string | null;
  location: {
    city: string | null;
    countryName: string | null;
    countryEmoji: string | null;
  } | null;
  university: string | null;
  languages: string[];
  sharedInterests: string[];
  lookingFor: string[];
  official: {
    organizationType: string | null;
    organizationName: string | null;
    verifiedAt: string | null;
  } | null;
};
