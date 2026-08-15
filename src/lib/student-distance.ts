import type { PlacePoint } from "@/lib/place-coordinates";

/**
 * How far apart two students are, honestly.
 *
 * The distance is between the places they study — a campus where the
 * university's location is known, otherwise the centre of their city. Kondo
 * never records where a person is, so this is the most precise thing that is
 * also true. It is computed on the server and only the rounded label crosses
 * the wire; a client never receives another student's coordinates.
 *
 * The surface this replaced measured to a point produced by hashing a profile
 * ID, which looked identical to a real number and was not one. Anything here
 * that cannot be computed returns `null` and shows no distance at all.
 */

const EARTH_RADIUS_KM = 6371;

export function haversineKilometres(first: PlacePoint, second: PlacePoint) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * The label a row shows.
 *
 * Rounded to whole kilometres, which is all anyone needs and all the source
 * data supports: a campus is hundreds of metres wide, so decimals here would
 * imply a precision that does not exist. Anything under a kilometre — the same
 * campus, or two neighbouring ones — is "< 1 km away" rather than a number
 * that would pretend to locate someone within a street.
 */
export function distanceLabel(kilometres: number | null): string | null {
  if (kilometres === null || !Number.isFinite(kilometres)) return null;
  if (kilometres < 1) return "< 1 km away";
  return `${Math.round(kilometres)} km away`;
}

/** Decimal columns arrive as strings or Prisma Decimals; normalise to a point. */
export function toPoint(
  latitude: unknown,
  longitude: unknown,
): PlacePoint | null {
  const lat =
    latitude === null || latitude === undefined ? NaN : Number(latitude);
  const lng =
    longitude === null || longitude === undefined ? NaN : Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

/**
 * A student's study point: their campus when it is known, their city otherwise.
 *
 * Campus first because Nearby is usually scoped to a single city, where every
 * city centroid is the same point and every row would claim the same distance.
 */
export function studyPoint(input: {
  universityLatitude?: unknown;
  universityLongitude?: unknown;
  cityLatitude?: unknown;
  cityLongitude?: unknown;
}): PlacePoint | null {
  return (
    toPoint(input.universityLatitude, input.universityLongitude) ??
    toPoint(input.cityLatitude, input.cityLongitude)
  );
}

/** Kilometres between two study points, or null when either is unknown. */
export function studentDistanceKilometres(
  viewer: PlacePoint | null,
  candidate: PlacePoint | null,
): number | null {
  if (!viewer || !candidate) return null;
  return haversineKilometres(viewer, candidate);
}
