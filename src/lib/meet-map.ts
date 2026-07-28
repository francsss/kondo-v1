export type MeetMapDistance =
  "KM_5" | "KM_10" | "KM_20" | "CITY" | "OTHER_CITY";

export type MapCoordinate = { lng: number; lat: number };

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
  coordinate: MapCoordinate;
}> = [
  {
    aliases: ["嘉兴大学", "jiaxing university"],
    coordinate: { lng: 120.755, lat: 30.746 },
  },
];

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
  const first = stableHash(`${profileId}:angle`);
  const second = stableHash(`${profileId}:radius`);
  const angle = (first / 0xffffffff) * Math.PI * 2;
  const radius =
    RADIUS_KM[distance] * (0.18 + Math.sqrt(second / 0xffffffff) * 0.7);
  const latitudeDelta = (Math.sin(angle) * radius) / 111.32;
  const longitudeScale = Math.max(0.2, Math.cos((anchor.lat * Math.PI) / 180));
  const longitudeDelta = (Math.cos(angle) * radius) / (111.32 * longitudeScale);
  return {
    lng: Number((anchor.lng + longitudeDelta).toFixed(6)),
    lat: Number((anchor.lat + latitudeDelta).toFixed(6)),
  };
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
