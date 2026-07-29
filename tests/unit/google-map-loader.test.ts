import { beforeEach, describe, expect, it, vi } from "vitest";

const { importLibrary, setOptions } = vi.hoisted(() => ({
  importLibrary: vi.fn(),
  setOptions: vi.fn(),
}));

vi.mock("@googlemaps/js-api-loader", () => ({
  importLibrary,
  setOptions,
}));

import {
  loadGoogleMaps,
  resetGoogleMapsLoaderForTests,
  retryGoogleMapsAfterFailure,
  subscribeToGoogleMapsErrors,
} from "@/lib/maps/google-map-loader";

describe("Google Maps loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGoogleMapsLoaderForTests();
    importLibrary.mockImplementation((library: string) =>
      Promise.resolve({ library }),
    );
  });

  it("configures the official loader once and shares one promise", async () => {
    const first = loadGoogleMaps("AIza-test-browser-key");
    const second = loadGoogleMaps("AIza-test-browser-key");

    expect(first).toBe(second);
    await expect(first).resolves.toEqual({
      maps: { library: "maps" },
      geocoding: { library: "geocoding" },
    });
    expect(setOptions).toHaveBeenCalledTimes(1);
    expect(setOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        authReferrerPolicy: "origin",
        key: "AIza-test-browser-key",
      }),
    );
    expect(importLibrary).toHaveBeenCalledTimes(2);
  });

  it("reports a missing or changed browser key precisely", async () => {
    await expect(loadGoogleMaps("")).rejects.toMatchObject({
      code: "API_KEY_MISSING",
    });
    await loadGoogleMaps("AIza-first-key");
    await expect(loadGoogleMaps("AIza-second-key")).rejects.toMatchObject({
      code: "API_KEY_CHANGED",
    });
  });

  it("permits a same-key retry after a loader failure", async () => {
    importLibrary.mockRejectedValueOnce(new Error("network unavailable"));
    await expect(loadGoogleMaps("AIza-test-browser-key")).rejects.toMatchObject(
      {
        code: "SDK_LOAD_FAILED",
      },
    );
    retryGoogleMapsAfterFailure();
    importLibrary.mockResolvedValue({ library: "retry" });

    await expect(loadGoogleMaps("AIza-test-browser-key")).resolves.toEqual({
      maps: { library: "retry" },
      geocoding: { library: "retry" },
    });
  });

  it("surfaces browser-key authentication failures to the active map", async () => {
    const browserWindow: { gm_authFailure?: () => void } = {};
    vi.stubGlobal("window", browserWindow);
    const listener = vi.fn();
    const unsubscribe = subscribeToGoogleMapsErrors(listener);
    await loadGoogleMaps("AIza-test-browser-key");

    browserWindow.gm_authFailure?.();

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "AUTHENTICATION_FAILED",
        message: expect.stringContaining("HTTP referrer"),
      }),
    );
    unsubscribe();
    vi.unstubAllGlobals();
  });
});
