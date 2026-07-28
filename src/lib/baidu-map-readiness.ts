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
] as const;

export function baiduMapSdkUrl(apiKey: string) {
  const parameters = new URLSearchParams({
    v: "3.0",
    ak: apiKey,
    services: "",
  });
  return `https://api.map.baidu.com/getscript?${parameters.toString()}`;
}

export function hasRequiredBaiduMapConstructors(value: unknown) {
  if (!value || typeof value !== "object") return false;

  return REQUIRED_BAIDU_CONSTRUCTORS.every(
    (constructorName) =>
      typeof (value as Record<string, unknown>)[constructorName] === "function",
  );
}
