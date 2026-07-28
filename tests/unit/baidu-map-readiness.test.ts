import { describe, expect, it } from "vitest";
import {
  baiduMapSdkUrl,
  hasRequiredBaiduMapConstructors,
} from "@/lib/baidu-map-readiness";

const requiredConstructors = {
  Map: function Map() {},
  Point: function Point() {},
  Geocoder: function Geocoder() {},
  NavigationControl: function NavigationControl() {},
  ScaleControl: function ScaleControl() {},
  Size: function Size() {},
  Icon: function Icon() {},
  Marker: function Marker() {},
  Circle: function Circle() {},
  Label: function Label() {},
  Convertor: function Convertor() {},
};

describe("Baidu Maps SDK readiness", () => {
  it("uses the official JSAPI 4.0 endpoint without the legacy GL selector", () => {
    const url = new URL(
      baiduMapSdkUrl("public-browser-key", "__kondoBaiduMapReady"),
    );

    expect(url.pathname).toBe("/api");
    expect(url.searchParams.has("type")).toBe(false);
    expect(url.searchParams.get("v")).toBe("4.0");
    expect(url.searchParams.get("ak")).toBe("public-browser-key");
    expect(url.searchParams.get("callback")).toBe("__kondoBaiduMapReady");
  });

  it("does not accept the partial namespace Baidu exposes while loading", () => {
    expect(hasRequiredBaiduMapConstructors({})).toBe(false);
    expect(
      hasRequiredBaiduMapConstructors({
        ...requiredConstructors,
        Map: undefined,
      }),
    ).toBe(false);
  });

  it("accepts the SDK only after every map constructor is available", () => {
    expect(hasRequiredBaiduMapConstructors(requiredConstructors)).toBe(true);
  });
});
