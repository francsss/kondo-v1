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

export const BAIDU_MAP_CALLBACK = "__kondoBaiduMapReady";

export function baiduMapSdkUrl(apiKey: string, callback = BAIDU_MAP_CALLBACK) {
  const parameters = new URLSearchParams({
    type: "webgl",
    v: "4.0",
    ak: apiKey,
    callback,
  });
  return `https://api.map.baidu.com/api?${parameters.toString()}`;
}

export function hasRequiredBaiduMapConstructors(value: unknown) {
  if (!value || typeof value !== "object") return false;

  return REQUIRED_BAIDU_CONSTRUCTORS.every(
    (constructorName) =>
      typeof (value as Record<string, unknown>)[constructorName] === "function",
  );
}
