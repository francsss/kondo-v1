const REQUIRED_BAIDU_CONSTRUCTORS = [
  "Map",
  "Point",
  "Geocoder",
  "NavigationControl",
  "ScaleControl",
  "Size",
  "Icon",
  "Marker",
  "Circle",
  "Label",
  "Convertor",
] as const;

export const BAIDU_MAP_VERSION = "4.0" as const;

export function baiduMapSdkUrl(apiKey: string, callback?: string) {
  const parameters = new URLSearchParams({
    v: BAIDU_MAP_VERSION,
    ak: apiKey,
  });
  if (callback) parameters.set("callback", callback);
  return `https://api.map.baidu.com/api?${parameters.toString()}`;
}

export function hasRequiredBaiduMapConstructors(value: unknown) {
  if (!value || typeof value !== "object") return false;

  return REQUIRED_BAIDU_CONSTRUCTORS.every(
    (constructorName) =>
      typeof (value as Record<string, unknown>)[constructorName] === "function",
  );
}
