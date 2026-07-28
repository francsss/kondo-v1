import { describe, expect, it, vi } from "vitest";
import {
  convertCoordinateToBd09,
  type BaiduMapsApi,
  type BaiduTranslateResult,
} from "@/lib/baidu-map-sdk";

function apiWithCoordinateResult(
  result: BaiduTranslateResult | null,
  onTranslate?: (from: number, to: number) => void,
) {
  return {
    Convertor: class {
      translate(
        _points: Array<{ lng: number; lat: number }>,
        from: number,
        to: number,
        callback: (value: BaiduTranslateResult | null) => void,
      ) {
        onTranslate?.(from, to);
        callback(result);
      }
    },
  } as unknown as BaiduMapsApi;
}

describe("Baidu coordinate conversion", () => {
  it("keeps coordinates that are already BD-09 unchanged", async () => {
    const point = { lng: 120.755, lat: 30.746 };
    const api = apiWithCoordinateResult(null);

    await expect(convertCoordinateToBd09(api, point, "BD09")).resolves.toBe(
      point,
    );
  });

  it.each([
    ["WGS84", 1],
    ["GCJ02", 3],
  ] as const)(
    "uses Baidu Convertor for %s coordinates",
    async (source, expectedSourceCode) => {
      const translated = { lng: 120.765, lat: 30.756 };
      const translate = vi.fn();
      const api = apiWithCoordinateResult(
        { status: 0, points: [translated] },
        translate,
      );

      await expect(
        convertCoordinateToBd09(api, { lng: 120.755, lat: 30.746 }, source),
      ).resolves.toEqual(translated);
      expect(translate).toHaveBeenCalledWith(expectedSourceCode, 5);
    },
  );

  it("propagates a real Baidu conversion failure", async () => {
    const api = apiWithCoordinateResult({ status: 21 });

    await expect(
      convertCoordinateToBd09(api, { lng: 120.755, lat: 30.746 }, "WGS84"),
    ).rejects.toThrow("status 21");
  });
});
