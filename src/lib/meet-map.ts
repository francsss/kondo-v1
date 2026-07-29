export type MeetMapDistance =
  "KM_5" | "KM_10" | "KM_20" | "CITY" | "OTHER_CITY";

export type MeetNearbyRadiusMeters = 100 | 300 | 500 | 1000 | 2000 | 5000;

export type MapCoordinate = { lng: number; lat: number };
export type Wgs84Coordinate = MapCoordinate & {
  readonly coordinateSystem: "WGS84";
};

export const MEET_MAP_COORDINATE_SYSTEM = "WGS84" as const;
export const DEFAULT_MEET_NEARBY_RADIUS_METERS: MeetNearbyRadiusMeters = 500;
export const MAX_MEET_NEARBY_RADIUS_METERS: MeetNearbyRadiusMeters = 5000;

// Public WGS-84 center of Jiaxing University's Lianglin campus. It is a
// university anchor, never a student's device position.
export const JIAXING_UNIVERSITY_WGS84: Wgs84Coordinate = {
  lng: 120.719407,
  lat: 30.743861,
  coordinateSystem: "WGS84",
};

const ZOOM_LEVEL: Record<MeetNearbyRadiusMeters, number> = {
  100: 18,
  300: 17,
  500: 16,
  1000: 15,
  2000: 14,
  5000: 13,
};

const KNOWN_STUDY_AREA_ANCHORS: Array<{
  aliases: string[];
  coordinate: Wgs84Coordinate;
}> = [
  {
    aliases: ["嘉兴大学", "嘉兴学院", "jiaxing university"],
    coordinate: JIAXING_UNIVERSITY_WGS84,
  },
];

export function isValidMeetMapCoordinate(
  value: unknown,
): value is MapCoordinate {
  if (!value || typeof value !== "object") return false;
  const coordinate = value as Partial<MapCoordinate>;
  if (
    !Number.isFinite(coordinate.lng) ||
    !Number.isFinite(coordinate.lat) ||
    (coordinate.lng === 0 && coordinate.lat === 0)
  ) {
    return false;
  }

  // Meet currently supports study areas in mainland China. The bounds also
  // catch a common latitude/longitude reversal before a provider receives it.
  return (
    coordinate.lng! >= 73 &&
    coordinate.lng! <= 136 &&
    coordinate.lat! >= 18 &&
    coordinate.lat! <= 54
  );
}

export function isLikelyReversedMeetMapCoordinate(value: MapCoordinate) {
  return (
    value.lat >= 73 && value.lat <= 136 && value.lng >= 18 && value.lng <= 54
  );
}

export function deduplicateMeetMapItems<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function stableHash(value: string) {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function meetMapZoom(radiusMeters: MeetNearbyRadiusMeters) {
  return ZOOM_LEVEL[radiusMeters];
}

export function meetMapKnownAnchor(queries: string[]) {
  const normalizedQueries = queries.map((query) => query.trim().toLowerCase());
  return (
    KNOWN_STUDY_AREA_ANCHORS.find(({ aliases }) =>
      aliases.some((alias) =>
        normalizedQueries.some((query) => query.includes(alias)),
      ),
    )?.coordinate ?? null
  );
}

export function privacySafeMapCoordinate(
  anchor: MapCoordinate,
  profileId: string,
): MapCoordinate {
  if (!isValidMeetMapCoordinate(anchor)) {
    throw new Error("Meet map anchor must be a valid China WGS-84 coordinate.");
  }
  if (!profileId.trim()) {
    throw new Error("Meet map profile ID is required.");
  }
  const first = stableHash(`${profileId}:angle`);
  const second = stableHash(`${profileId}:radius`);
  const angle = (first / 0xffffffff) * Math.PI * 2;
  // Squaring biases the privacy-safe distribution toward campus while keeping
  // a stable long tail out to 5 km. Changing the selected filter never moves a
  // marker; it only changes which approximate points are visible.
  const normalizedRadius = second / 0xffffffff;
  const radiusMeters = 45 + normalizedRadius ** 2 * 4_800;
  const latitudeDelta = (Math.sin(angle) * radiusMeters) / 111_320;
  const longitudeScale = Math.max(0.2, Math.cos((anchor.lat * Math.PI) / 180));
  const longitudeDelta =
    (Math.cos(angle) * radiusMeters) / (111_320 * longitudeScale);
  const coordinate = {
    lng: Number((anchor.lng + longitudeDelta).toFixed(6)),
    lat: Number((anchor.lat + latitudeDelta).toFixed(6)),
  };
  if (!isValidMeetMapCoordinate(coordinate)) {
    throw new Error("Generated Meet map coordinate is outside China.");
  }
  return coordinate;
}

export function privacySafeViewerCoordinate(
  anchor: MapCoordinate,
  profileId: string,
) {
  const distributed = privacySafeMapCoordinate(anchor, `${profileId}:viewer`);
  return {
    lat: Number(
      (anchor.lat + (distributed.lat - anchor.lat) * 0.018).toFixed(6),
    ),
    lng: Number(
      (anchor.lng + (distributed.lng - anchor.lng) * 0.018).toFixed(6),
    ),
  };
}

export function approximateDistanceMeters(
  first: MapCoordinate,
  second: MapCoordinate,
) {
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = ((second.lat - first.lat) * Math.PI) / 180;
  const longitudeDelta = ((second.lng - first.lng) * Math.PI) / 180;
  const firstLatitude = (first.lat * Math.PI) / 180;
  const secondLatitude = (second.lat * Math.PI) / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(
    earthRadiusMeters *
      2 *
      Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)),
  );
}

export function friendlyApproximateDistance(distanceMeters: number) {
  if (distanceMeters < 100) return "Less than 100 m";
  if (distanceMeters < 250) return "Around 200 m";
  if (distanceMeters < 400) return "Around 300 m";
  if (distanceMeters < 750) return "Around 500 m";
  if (distanceMeters < 1_500) return "Around 1 km";
  if (distanceMeters < 3_000) return "Around 2 km";
  if (distanceMeters <= 5_000) return "Around 5 km";
  return "More than 5 km";
}

export function meetMapSearchQuery(
  universityName: string | null,
  cityName: string | null,
) {
  return [universityName, cityName, "China"].filter(Boolean).join(", ");
}

function cleanUniversityLabel(value: string | null) {
  return value?.split(" · ")[0]?.trim() || null;
}

function cleanCityLabel(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

export function meetMapSearchQueries(input: {
  universityName: string | null;
  universityNativeName?: string | null;
  cityName: string | null;
  cityNativeName?: string | null;
}) {
  const universityName = cleanUniversityLabel(input.universityName);
  const cityName = cleanCityLabel(input.cityName);
  const universityNativeName = input.universityNativeName?.trim() || null;
  const cityNativeName = input.cityNativeName?.trim() || null;
  const queries = [
    universityName && cityName
      ? meetMapSearchQuery(universityName, cityName)
      : universityName,
    universityName,
    universityNativeName && cityNativeName
      ? `${cityNativeName}${universityNativeName}`
      : universityNativeName,
    universityNativeName,
    cityName,
    cityNativeName,
  ].filter((value): value is string => Boolean(value));

  return [...new Set(queries)];
}

export function meetMapCityQueries(
  cityName: string | null,
  cityNativeName?: string | null,
) {
  return [cleanCityLabel(cityName), cityNativeName?.trim() || null].filter(
    (value, index, values): value is string =>
      Boolean(value) && values.indexOf(value) === index,
  );
}
