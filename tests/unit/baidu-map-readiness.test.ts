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
};

describe("Baidu Maps SDK readiness", () => {
  it("loads the real SDK asset directly so its network failures can be retried", () => {
    const url = new URL(baiduMapSdkUrl("public-browser-key"));

    expect(url.pathname).toBe("/getscript");
    expect(url.searchParams.get("type")).toBe("webgl");
    expect(url.searchParams.get("v")).toBe("1.0");
    expect(url.searchParams.get("ak")).toBe("public-browser-key");
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
