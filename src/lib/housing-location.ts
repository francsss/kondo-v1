import type { HousingLocationPrivacy } from "@prisma/client";

export type HousingCoordinate = { lat: number; lng: number };

function stableHash(value: string) {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function isValidHousingCoordinate(value: HousingCoordinate) {
  return (
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng) &&
    value.lat >= -90 &&
    value.lat <= 90 &&
    value.lng >= -180 &&
    value.lng <= 180
  );
}

export function privacySafeHousingCoordinate(input: {
  exact: HousingCoordinate | null;
  anchor: HousingCoordinate | null;
  listingId: string;
  privacy: HousingLocationPrivacy;
}): HousingCoordinate | null {
  if (input.privacy === "DISTRICT_ONLY" || (!input.exact && !input.anchor)) {
    return null;
  }
  const source = input.exact ?? input.anchor!;
  if (!isValidHousingCoordinate(source)) return null;
  if (input.privacy === "PUBLIC_EXACT_LOCATION") return source;

  const angleHash = stableHash(`${input.listingId}:housing-angle`);
  const radiusHash = stableHash(`${input.listingId}:housing-radius`);
  const angle = (angleHash / 0xffffffff) * Math.PI * 2;
  const radiusMeters =
    input.privacy === "NEAR_UNIVERSITY"
      ? 180 + (radiusHash / 0xffffffff) * 420
      : 450 + (radiusHash / 0xffffffff) * 850;
  const latDelta = (Math.sin(angle) * radiusMeters) / 111_320;
  const scale = Math.max(0.2, Math.cos((source.lat * Math.PI) / 180));
  const lngDelta = (Math.cos(angle) * radiusMeters) / (111_320 * scale);
  return {
    lat: Number((source.lat + latDelta).toFixed(6)),
    lng: Number((source.lng + lngDelta).toFixed(6)),
  };
}

export function safeHousingMapPoint(input: {
  publicLatitude: unknown;
  publicLongitude: unknown;
  privacy: HousingLocationPrivacy;
}) {
  if (
    input.privacy === "DISTRICT_ONLY" ||
    input.publicLatitude == null ||
    input.publicLongitude == null
  ) {
    return null;
  }
  const point = {
    lat: Number(input.publicLatitude),
    lng: Number(input.publicLongitude),
  };
  return isValidHousingCoordinate(point) ? point : null;
}
