"use client";

import BMapLoader from "@baidumap/jsapi-loader";
import {
  BAIDU_MAP_VERSION,
  hasRequiredBaiduMapConstructors,
} from "@/lib/baidu-map-readiness";

export type BaiduPoint = { lng: number; lat: number };

export type BaiduOverlay = {
  addEventListener?(event: string, listener: () => void): void;
  removeEventListener?(event: string, listener: () => void): void;
};

export type BaiduMarker = BaiduOverlay & {
  setLabel?(label: BaiduOverlay): void;
  setIcon?(icon: unknown): void;
};

export type BaiduMapInstance = {
  centerAndZoom(point: BaiduPoint, zoom: number): void;
  enableScrollWheelZoom(): void;
  checkResize?(): void;
  addControl(control: unknown): void;
  addOverlay(overlay: BaiduOverlay): void;
  removeOverlay(overlay: BaiduOverlay): void;
  clearOverlays(): void;
  addEventListener(event: string, listener: () => void): void;
  removeEventListener(event: string, listener: () => void): void;
  isLoaded?(): boolean;
  destroy?(): void;
};

export type BaiduTranslateResult = {
  status: number;
  points?: BaiduPoint[];
};

export type BaiduMapsApi = {
  Map: new (
    container: HTMLElement,
    options?: {
      center?: BaiduPoint;
      zoom?: number;
      enableMapClick?: boolean;
      enableWheelZoom?: boolean;
      enableAutoResize?: boolean;
    },
  ) => BaiduMapInstance;
  Point: new (lng: number, lat: number) => BaiduPoint;
  Geocoder: new () => {
    getPoint(
      query: string,
      callback: (point: BaiduPoint | null) => void,
      city?: string,
    ): void;
  };
  NavigationControl: new () => unknown;
  ScaleControl: new () => unknown;
  Size: new (width: number, height: number) => unknown;
  Icon: new (
    imageUrl: string,
    size: unknown,
    options?: { imageSize?: unknown; anchor?: unknown },
  ) => unknown;
  Marker: new (
    point: BaiduPoint,
    options?: { icon?: unknown; title?: string },
  ) => BaiduMarker;
  Circle: new (
    point: BaiduPoint,
    radiusMeters: number,
    options?: Record<string, unknown>,
  ) => BaiduOverlay;
  Label: new (
    content: string,
    options?: { position?: BaiduPoint; offset?: unknown },
  ) => BaiduOverlay & {
    setStyle?(styles: Record<string, string | number>): void;
  };
  Convertor: new () => {
    translate(
      points: BaiduPoint[],
      from: number,
      to: number,
      callback: (result: BaiduTranslateResult | null) => void,
    ): void;
  };
};

type BaiduBusinessInfo = {
  unauth?: number | string;
};

type LoaderState = {
  apiKey: string;
  status: "loading" | "ready" | "failed";
  promise: Promise<BaiduMapsApi>;
};

type BaiduWindow = Window & {
  BMap?: unknown;
  BMapGL?: unknown;
  B_BUSINESS_INFO?: BaiduBusinessInfo;
  __kondoBaiduMapLoaderState?: LoaderState;
};

export type BaiduMapErrorCode =
  | "SDK_REQUEST_FAILED"
  | "SDK_BLOCKED"
  | "SDK_CALLBACK_INCOMPLETE"
  | "SDK_AK_REJECTED"
  | "SDK_KEY_CHANGED"
  | "SDK_NAMESPACE_MISMATCH";

export type BaiduCoordinateSystem = "BD09" | "GCJ02" | "WGS84";

export class BaiduMapError extends Error {
  constructor(
    public readonly code: BaiduMapErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BaiduMapError";
  }
}

export function logBaiduMapEvent(
  event: string,
  details: Record<string, unknown> = {},
) {
  console.info("[Kondo Meet Map]", event, details);
}

function baiduWindow() {
  return window as BaiduWindow;
}

function authWasRejected(scope: BaiduWindow) {
  const unauth = Number(scope.B_BUSINESS_INFO?.unauth ?? 0);
  return Number.isFinite(unauth) && unauth !== 0;
}

export function loadBaiduMapsSdk(apiKey: string): Promise<BaiduMapsApi> {
  const normalizedKey = apiKey.trim();
  const scope = baiduWindow();

  if (!normalizedKey) {
    return Promise.reject(
      new BaiduMapError(
        "SDK_REQUEST_FAILED",
        "NEXT_PUBLIC_BAIDU_MAP_AK is empty.",
      ),
    );
  }
  if (hasRequiredBaiduMapConstructors(scope.BMap)) {
    if (authWasRejected(scope)) {
      return Promise.reject(
        new BaiduMapError(
          "SDK_AK_REJECTED",
          "Baidu rejected the browser API key. Verify that JavaScript API is enabled and the production, preview, and localhost Referers are allowed.",
        ),
      );
    }
    logBaiduMapEvent("sdk.already_ready");
    return Promise.resolve(scope.BMap as BaiduMapsApi);
  }
  const existingState = scope.__kondoBaiduMapLoaderState;
  if (existingState) {
    if (existingState.apiKey !== normalizedKey) {
      return Promise.reject(
        new BaiduMapError(
          "SDK_KEY_CHANGED",
          "The Baidu browser API key changed after SDK loading started.",
        ),
      );
    }
    logBaiduMapEvent("sdk.promise_reused");
    return existingState.promise;
  }

  let cspViolation: SecurityPolicyViolationEvent | null = null;
  const handleSecurityPolicyViolation = (
    event: SecurityPolicyViolationEvent,
  ) => {
    if (!event.blockedURI.includes("api.map.baidu.com")) return;
    cspViolation = event;
    console.error("[Kondo Meet Map]", "sdk.csp_blocked", {
      blockedHost: safeResourceHost(event.blockedURI),
      directive: event.effectiveDirective,
    });
  };
  window.addEventListener(
    "securitypolicyviolation",
    handleSecurityPolicyViolation,
  );
  logBaiduMapEvent("sdk.load_started", {
    endpoint: "https://api.map.baidu.com/api",
    namespace: "BMap",
    version: BAIDU_MAP_VERSION,
  });

  const promise = BMapLoader.load({
    ak: normalizedKey,
    version: BAIDU_MAP_VERSION,
    protocol: "https",
    timeout: 0,
    globalConfig: {
      coordType: "bd09ll",
    },
  })
    .then((loadedNamespace: unknown) => {
      if (authWasRejected(scope)) {
        throw new BaiduMapError(
          "SDK_AK_REJECTED",
          "Baidu rejected the browser API key. Verify that JavaScript API is enabled and the production, preview, and localhost Referers are allowed.",
        );
      }
      const namespace = scope.BMap ?? loadedNamespace;
      if (!hasRequiredBaiduMapConstructors(namespace)) {
        if (hasRequiredBaiduMapConstructors(scope.BMapGL)) {
          throw new BaiduMapError(
            "SDK_NAMESPACE_MISMATCH",
            "Baidu loaded the legacy BMapGL namespace instead of the JSAPI 4.0 BMap namespace.",
          );
        }
        throw new BaiduMapError(
          "SDK_CALLBACK_INCOMPLETE",
          "Baidu completed its SDK callback without a complete JSAPI 4.0 BMap namespace.",
        );
      }
      const state = scope.__kondoBaiduMapLoaderState;
      if (state) state.status = "ready";
      logBaiduMapEvent("sdk.ready", {
        hasBMap: true,
        hasBMapGL: hasRequiredBaiduMapConstructors(scope.BMapGL),
        loaderStatus: BMapLoader.getStatus(),
        namespace: "BMap",
        version: BAIDU_MAP_VERSION,
      });
      return namespace as BaiduMapsApi;
    })
    .catch((error: unknown) => {
      const failure =
        cspViolation !== null
          ? new BaiduMapError(
              "SDK_BLOCKED",
              `The page Content Security Policy blocked the Baidu SDK (${cspViolation.effectiveDirective}).`,
            )
          : error instanceof BaiduMapError
            ? error
            : new BaiduMapError(
                "SDK_REQUEST_FAILED",
                error instanceof Error
                  ? error.message
                  : "The Baidu JSAPI 4.0 request failed.",
              );
      const state = scope.__kondoBaiduMapLoaderState;
      if (state) state.status = "failed";
      console.error("[Kondo Meet Map]", "sdk.failed", {
        code: failure.code,
        message: failure.message,
      });
      throw failure;
    })
    .finally(() => {
      window.removeEventListener(
        "securitypolicyviolation",
        handleSecurityPolicyViolation,
      );
    });

  scope.__kondoBaiduMapLoaderState = {
    apiKey: normalizedKey,
    status: "loading",
    promise,
  };
  return promise;
}

const BAIDU_COORDINATE_CODES: Record<
  Exclude<BaiduCoordinateSystem, "BD09">,
  number
> = {
  WGS84: 1,
  GCJ02: 3,
};

export function convertCoordinateToBd09(
  api: BaiduMapsApi,
  point: BaiduPoint,
  source: BaiduCoordinateSystem,
) {
  if (source === "BD09") {
    return Promise.resolve(point);
  }

  return new Promise<BaiduPoint>((resolve, reject) => {
    logBaiduMapEvent("coordinate_conversion.request", {
      from: source,
      to: "BD09",
    });
    const convertor = new api.Convertor();
    convertor.translate(
      [point],
      BAIDU_COORDINATE_CODES[source],
      5,
      (result) => {
        const converted = result?.points?.[0];
        if (!result || result.status !== 0 || !converted) {
          const status = result?.status ?? "no_response";
          console.error("[Kondo Meet Map]", "coordinate_conversion.failed", {
            from: source,
            to: "BD09",
            status,
          });
          reject(
            new Error(
              `Baidu coordinate conversion failed (${source} → BD09, status ${status}).`,
            ),
          );
          return;
        }
        logBaiduMapEvent("coordinate_conversion.complete", {
          from: source,
          to: "BD09",
        });
        resolve(converted);
      },
    );
  });
}

export function resetBaiduMapsSdkAfterFailure() {
  const scope = baiduWindow();
  const state = scope.__kondoBaiduMapLoaderState;
  if (
    state?.status === "loading" ||
    (state?.status !== "failed" && hasRequiredBaiduMapConstructors(scope.BMap))
  ) {
    return false;
  }
  BMapLoader.reset();
  delete scope.__kondoBaiduMapLoaderState;
  for (const script of document.querySelectorAll<HTMLScriptElement>(
    'script[src*="api.map.baidu.com/api"][src*="v=4.0"]',
  )) {
    script.remove();
  }
  logBaiduMapEvent("sdk.failure_reset");
  return true;
}

function safeResourceHost(value: string) {
  try {
    return new URL(value, window.location.href).host;
  } catch {
    return "unknown";
  }
}

function isBaiduResource(value: string) {
  const host = safeResourceHost(value);
  return (
    host === "api.map.baidu.com" ||
    host.endsWith(".baidu.com") ||
    host.endsWith(".bdimg.com") ||
    host.endsWith(".bcebos.com")
  );
}

export function observeBaiduMapResourceFailures(signal: AbortSignal) {
  const handleResourceError = (event: Event) => {
    const target = event.target;
    const resource =
      target instanceof HTMLScriptElement
        ? target.src
        : target instanceof HTMLImageElement
          ? target.currentSrc || target.src
          : target instanceof HTMLLinkElement
            ? target.href
            : "";
    if (!resource || !isBaiduResource(resource)) return;
    console.error("[Kondo Meet Map]", "network.resource_failed", {
      host: safeResourceHost(resource),
      tag: target instanceof Element ? target.tagName.toLowerCase() : "unknown",
    });
  };
  const handleSecurityPolicyViolation = (
    event: SecurityPolicyViolationEvent,
  ) => {
    if (!isBaiduResource(event.blockedURI)) return;
    console.error("[Kondo Meet Map]", "network.csp_blocked", {
      blockedHost: safeResourceHost(event.blockedURI),
      directive: event.effectiveDirective,
    });
  };
  const cleanup = () => {
    window.removeEventListener("error", handleResourceError, true);
    window.removeEventListener(
      "securitypolicyviolation",
      handleSecurityPolicyViolation,
    );
    signal.removeEventListener("abort", cleanup);
  };

  window.addEventListener("error", handleResourceError, true);
  window.addEventListener(
    "securitypolicyviolation",
    handleSecurityPolicyViolation,
  );
  signal.addEventListener("abort", cleanup, { once: true });
  return cleanup;
}

function containerMeasurement(container: HTMLElement) {
  const bounds = container.getBoundingClientRect();
  const styles = window.getComputedStyle(container);
  return {
    width: bounds.width,
    height: bounds.height,
    display: styles.display,
    visibility: styles.visibility,
    connected: container.isConnected,
  };
}

export function waitForBaiduMapContainer(
  container: HTMLElement,
  signal: AbortSignal,
) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    let animationFrame = 0;
    let observer: ResizeObserver | null = null;
    const cleanup = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      observer?.disconnect();
      signal.removeEventListener("abort", handleAbort);
    };
    const handleAbort = () => {
      cleanup();
      reject(
        new DOMException("Map initialization was cancelled.", "AbortError"),
      );
    };
    const check = () => {
      if (signal.aborted) {
        handleAbort();
        return;
      }
      const measurement = containerMeasurement(container);
      if (
        measurement.connected &&
        measurement.width > 0 &&
        measurement.height > 0 &&
        measurement.display !== "none" &&
        measurement.visibility !== "hidden"
      ) {
        cleanup();
        logBaiduMapEvent("container.ready", {
          width: Math.round(measurement.width),
          height: Math.round(measurement.height),
        });
        resolve({
          width: measurement.width,
          height: measurement.height,
        });
        return;
      }
      animationFrame = window.requestAnimationFrame(check);
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    if (typeof ResizeObserver === "function") {
      observer = new ResizeObserver(check);
      observer.observe(container);
    }
    check();
  });
}

export function inspectBaiduMapRenderer(
  map: BaiduMapInstance,
  container: HTMLElement,
) {
  const canvases = Array.from(container.querySelectorAll("canvas"));
  const drawableCanvas = canvases.find(
    (canvas) => canvas.width > 0 && canvas.height > 0,
  );
  return {
    canvasCount: canvases.length,
    canvasHeight: drawableCanvas?.height ?? 0,
    canvasWidth: drawableCanvas?.width ?? 0,
    initialized: map.isLoaded?.() ?? true,
  };
}
