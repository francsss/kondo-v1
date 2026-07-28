import { afterEach, describe, expect, it, vi } from "vitest";

const loader = vi.hoisted(() => ({
  getStatus: vi.fn(() => "notload"),
  load: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("@baidumap/jsapi-loader", () => ({
  default: loader,
}));

import {
  BaiduMapError,
  loadBaiduMapsSdk,
  type BaiduMapsApi,
} from "@/lib/baidu-map-sdk";

function completeNamespace() {
  return {
    Circle: class Circle {},
    Convertor: class Convertor {},
    Geocoder: class Geocoder {},
    Icon: class Icon {},
    Label: class Label {},
    Map: class Map {},
    Marker: class Marker {},
    NavigationControl: class NavigationControl {},
    Point: class Point {},
    ScaleControl: class ScaleControl {},
    Size: class Size {},
  } as unknown as BaiduMapsApi;
}

function installWindow(namespace?: BaiduMapsApi) {
  vi.stubGlobal("window", {
    BMapGL: namespace,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  loader.getStatus.mockReturnValue("notload");
  loader.load.mockReset();
  loader.reset.mockReset();
});

describe("Baidu JSAPI loader", () => {
  it("returns an already complete BMapGL namespace without injecting again", async () => {
    const namespace = completeNamespace();
    installWindow(namespace);

    await expect(loadBaiduMapsSdk("browser-ak")).resolves.toBe(namespace);
    expect(loader.load).not.toHaveBeenCalled();
  });

  it("shares one loading promise across concurrent React effects", async () => {
    installWindow();
    const namespace = completeNamespace();
    loader.load.mockResolvedValue(namespace);

    const first = loadBaiduMapsSdk("browser-ak");
    const second = loadBaiduMapsSdk("browser-ak");

    await expect(Promise.all([first, second])).resolves.toEqual([
      namespace,
      namespace,
    ]);
    expect(loader.load).toHaveBeenCalledTimes(1);
    expect(loader.load).toHaveBeenCalledWith(
      expect.objectContaining({
        ak: "browser-ak",
        protocol: "https",
        timeout: 20_000,
        version: "4.0",
      }),
    );
  });

  it("propagates a script request failure with a diagnostic code", async () => {
    installWindow();
    vi.spyOn(console, "error").mockImplementation(() => {});
    loader.load.mockRejectedValue(new Error("JSAPI script request failed"));

    await expect(loadBaiduMapsSdk("browser-ak")).rejects.toMatchObject({
      code: "SDK_REQUEST_FAILED",
      message: "JSAPI script request failed",
    } satisfies Partial<BaiduMapError>);
  });

  it("settles with an error when the underlying SDK loader times out", async () => {
    vi.useFakeTimers();
    installWindow();
    vi.spyOn(console, "error").mockImplementation(() => {});
    loader.load.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error("JSAPI load timed out")), 20_000);
        }),
    );

    const loading = loadBaiduMapsSdk("browser-ak");
    const assertion = expect(loading).rejects.toMatchObject({
      code: "SDK_REQUEST_FAILED",
      message: "JSAPI load timed out",
    } satisfies Partial<BaiduMapError>);
    await vi.advanceTimersByTimeAsync(20_000);

    await assertion;
  });
});
