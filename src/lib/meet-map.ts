export type MeetMapDistance =
  "KM_5" | "KM_10" | "KM_20" | "CITY" | "OTHER_CITY";

export type MapCoordinate = { lng: number; lat: number };
export type Wgs84Coordinate = MapCoordinate & {
  readonly coordinateSystem: "WGS84";
};
export type Gcj02Coordinate = MapCoordinate & {
  readonly coordinateSystem: "GCJ02";
};
export type Bd09Coordinate = MapCoordinate & {
  readonly coordinateSystem: "BD09";
};
export const MEET_MAP_COORDINATE_SYSTEM = "BD09" as const;
export const JIAXING_UNIVERSITY_BD09: Bd09Coordinate = {
  lng: 120.730282,
  lat: 30.747312,
  coordinateSystem: "BD09",
};

const RADIUS_KM: Record<MeetMapDistance, number> = {
  KM_5: 5,
  KM_10: 10,
  KM_20: 20,
  CITY: 15,
  OTHER_CITY: 15,
};

const ZOOM_LEVEL: Record<MeetMapDistance, number> = {
  KM_5: 14,
  KM_10: 13,
  KM_20: 12,
  CITY: 12,
  OTHER_CITY: 12,
};

const KNOWN_STUDY_AREA_ANCHORS: Array<{
  aliases: string[];
  coordinate: Bd09Coordinate;
}> = [
  {
    aliases: ["嘉兴大学", "嘉兴学院", "jiaxing university"],
    // Baidu BD-09 center for the Lianglin campus near the university's
    // official address at 899 Guangqiong Road. This avoids geocoding during
    // map startup and must never be replaced with raw WGS-84 GPS coordinates.
    coordinate: JIAXING_UNIVERSITY_BD09,
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

  // Meet is currently limited to study areas in mainland China. These bounds
  // also catch the common latitude/longitude reversal before BMapGL.Point is
  // constructed.
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

export function meetMapRadiusKm(distance: MeetMapDistance) {
  return RADIUS_KM[distance];
}

export function meetMapZoom(distance: MeetMapDistance) {
  return ZOOM_LEVEL[distance];
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
  distance: MeetMapDistance,
): MapCoordinate {
  if (!isValidMeetMapCoordinate(anchor)) {
    throw new Error("Meet map anchor must be a valid China BD-09 coordinate.");
  }
  if (!profileId.trim()) {
    throw new Error("Meet map profile ID is required.");
  }
  const first = stableHash(`${profileId}:angle`);
  const second = stableHash(`${profileId}:radius`);
  const angle = (first / 0xffffffff) * Math.PI * 2;
  const radius =
    RADIUS_KM[distance] * (0.18 + Math.sqrt(second / 0xffffffff) * 0.7);
  const latitudeDelta = (Math.sin(angle) * radius) / 111.32;
  const longitudeScale = Math.max(0.2, Math.cos((anchor.lat * Math.PI) / 180));
  const longitudeDelta = (Math.cos(angle) * radius) / (111.32 * longitudeScale);
  const coordinate = {
    lng: Number((anchor.lng + longitudeDelta).toFixed(6)),
    lat: Number((anchor.lat + latitudeDelta).toFixed(6)),
  };
  if (!isValidMeetMapCoordinate(coordinate)) {
    throw new Error("Generated Meet map coordinate is outside China.");
  }
  return coordinate;
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
    universityNativeName && cityNativeName
      ? `${cityNativeName}${universityNativeName}`
      : universityNativeName,
    universityNativeName,
    universityName && cityName
      ? meetMapSearchQuery(universityName, cityName)
      : universityName,
    universityName,
    cityNativeName,
    cityName,
  ].filter((value): value is string => Boolean(value));

  return [...new Set(queries)];
}

export function meetMapCityQueries(
  cityName: string | null,
  cityNativeName?: string | null,
) {
  return [cityNativeName?.trim() || null, cleanCityLabel(cityName)].filter(
    (value, index, values): value is string =>
      Boolean(value) && values.indexOf(value) === index,
  );
}
