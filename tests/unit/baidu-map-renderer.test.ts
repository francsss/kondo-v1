import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BaiduMapError,
  type BaiduMapInstance,
  waitForBaiduMapContainer,
  waitForBaiduMapRenderer,
} from "@/lib/baidu-map-sdk";

type TilesLoadedListener = () => void;

function installBrowserGlobals() {
  vi.stubGlobal("window", {
    cancelAnimationFrame: vi.fn(),
    clearTimeout,
    getComputedStyle: () => ({
      display: "block",
      visibility: "visible",
    }),
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    },
    setTimeout,
  });
}

function mapWithTilesListener() {
  let tilesLoaded: TilesLoadedListener | null = null;
  const map = {
    addEventListener: vi.fn((event: string, listener: TilesLoadedListener) => {
      if (event === "tilesloaded") tilesLoaded = listener;
    }),
    removeEventListener: vi.fn(),
  } as unknown as BaiduMapInstance;

  return {
    map,
    emitTilesLoaded() {
      tilesLoaded?.();
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Baidu map renderer readiness", () => {
  it("resolves only after Baidu reports tiles and creates a drawable canvas", async () => {
    installBrowserGlobals();
    const canvas = { height: 480, width: 960 };
    const container = {
      querySelectorAll: vi.fn(() => [canvas]),
    } as unknown as HTMLElement;
    const { map, emitTilesLoaded } = mapWithTilesListener();
    const controller = new AbortController();

    const rendering = waitForBaiduMapRenderer(
      map,
      container,
      controller.signal,
      1_000,
    );
    emitTilesLoaded();

    await expect(rendering).resolves.toMatchObject({
      canvasCount: 1,
      canvasHeight: 480,
      canvasWidth: 960,
    });
  });

  it("returns the real renderer failure instead of loading forever", async () => {
    vi.useFakeTimers();
    installBrowserGlobals();
    const container = {
      querySelectorAll: vi.fn(() => []),
    } as unknown as HTMLElement;
    const { map } = mapWithTilesListener();
    const controller = new AbortController();

    const rendering = waitForBaiduMapRenderer(
      map,
      container,
      controller.signal,
      25,
    );
    const assertion = expect(rendering).rejects.toMatchObject({
      code: "MAP_RENDER_FAILED",
    } satisfies Partial<BaiduMapError>);
    await vi.advanceTimersByTimeAsync(25);

    await assertion;
  });

  it("reports a hidden zero-size container instead of waiting forever", async () => {
    vi.useFakeTimers();
    installBrowserGlobals();
    window.requestAnimationFrame = vi.fn(() => 1);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect() {}
        observe() {}
      },
    );
    const container = {
      getBoundingClientRect: () => ({ height: 0, width: 0 }),
      isConnected: true,
    } as unknown as HTMLElement;

    const readiness = waitForBaiduMapContainer(
      container,
      new AbortController().signal,
      25,
    );
    const assertion = expect(readiness).rejects.toMatchObject({
      code: "MAP_CONTAINER_INVALID",
    } satisfies Partial<BaiduMapError>);
    await vi.advanceTimersByTimeAsync(25);

    await assertion;
  });
});
