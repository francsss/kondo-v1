"use client";

import {
  BAIDU_MAP_CALLBACK,
  baiduMapSdkUrl,
  hasRequiredBaiduMapConstructors,
} from "@/lib/baidu-map-readiness";

export type BaiduPoint = { lng: number; lat: number };

export type BaiduOverlay = {
  addEventListener?(event: string, listener: () => void): void;
  removeEventListener?(event: string, listener: () => void): void;
};

export type BaiduMarker = BaiduOverlay & {
  setLabel?(label: BaiduOverlay): void;
};

export type BaiduMapInstance = {
  centerAndZoom(point: BaiduPoint, zoom: number): void;
  enableScrollWheelZoom(enabled: boolean): void;
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
    options?: { enableMapClick?: boolean },
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

type BaiduWindow = Window & {
  BMapGL?: unknown;
  B_BUSINESS_INFO?: BaiduBusinessInfo;
  [BAIDU_MAP_CALLBACK]?: () => void;
};

export type BaiduMapErrorCode =
  | "SDK_REQUEST_FAILED"
  | "SDK_BLOCKED"
  | "SDK_CALLBACK_INCOMPLETE"
  | "SDK_AK_REJECTED"
  | "SDK_KEY_CHANGED";

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

type LoaderState = {
  apiKey: string;
  promise: Promise<BaiduMapsApi>;
};

const SCRIPT_ID = "kondo-baidu-map-sdk";
let loaderState: LoaderState | null = null;

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
  if (hasRequiredBaiduMapConstructors(scope.BMapGL)) {
    logBaiduMapEvent("sdk.already_ready");
    return Promise.resolve(scope.BMapGL as BaiduMapsApi);
  }
  if (loaderState) {
    if (loaderState.apiKey !== normalizedKey) {
      return Promise.reject(
        new BaiduMapError(
          "SDK_KEY_CHANGED",
          "The Baidu browser API key changed after SDK loading started.",
        ),
      );
    }
    logBaiduMapEvent("sdk.promise_reused");
    return loaderState.promise;
  }

  const promise = new Promise<BaiduMapsApi>((resolve, reject) => {
    let settled = false;
    const finishWithError = (error: BaiduMapError) => {
      if (settled) return;
      settled = true;
      window.removeEventListener(
        "securitypolicyviolation",
        handleSecurityPolicyViolation,
      );
      delete scope[BAIDU_MAP_CALLBACK];
      loaderState = null;
      console.error("[Kondo Meet Map]", "sdk.failed", {
        code: error.code,
        message: error.message,
      });
      reject(error);
    };
    const finishWithSdk = () => {
      if (settled) return;
      if (authWasRejected(scope)) {
        finishWithError(
          new BaiduMapError(
            "SDK_AK_REJECTED",
            "Baidu rejected the browser API key or its Referer allowlist.",
          ),
        );
        return;
      }
      if (!hasRequiredBaiduMapConstructors(scope.BMapGL)) {
        finishWithError(
          new BaiduMapError(
            "SDK_CALLBACK_INCOMPLETE",
            "Baidu called the SDK callback before BMapGL finished initializing.",
          ),
        );
        return;
      }
      settled = true;
      window.removeEventListener(
        "securitypolicyviolation",
        handleSecurityPolicyViolation,
      );
      delete scope[BAIDU_MAP_CALLBACK];
      const script = document.getElementById(SCRIPT_ID);
      if (script instanceof HTMLScriptElement) {
        script.dataset.kondoBaiduState = "ready";
      }
      logBaiduMapEvent("sdk.ready", {
        hasBMapGL: true,
        version: "4.0",
      });
      resolve(scope.BMapGL as BaiduMapsApi);
    };
    const handleSecurityPolicyViolation = (
      event: SecurityPolicyViolationEvent,
    ) => {
      if (!event.blockedURI.includes("api.map.baidu.com")) return;
      finishWithError(
        new BaiduMapError(
          "SDK_BLOCKED",
          `The page Content Security Policy blocked the Baidu SDK: ${event.effectiveDirective}.`,
        ),
      );
    };

    scope[BAIDU_MAP_CALLBACK] = finishWithSdk;
    window.addEventListener(
      "securitypolicyviolation",
      handleSecurityPolicyViolation,
    );

    const existing = document.getElementById(SCRIPT_ID);
    if (existing instanceof HTMLScriptElement) {
      logBaiduMapEvent("sdk.existing_script_attached", {
        state: existing.dataset.kondoBaiduState ?? "loading",
      });
      existing.addEventListener(
        "error",
        () =>
          finishWithError(
            new BaiduMapError(
              "SDK_REQUEST_FAILED",
              "The Baidu GL SDK request failed.",
            ),
          ),
        { once: true },
      );
      existing.addEventListener("load", finishWithSdk, { once: true });
      if (existing.dataset.kondoBaiduState === "ready") {
        queueMicrotask(finishWithSdk);
      }
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.dataset.kondoBaiduState = "loading";
    script.src = baiduMapSdkUrl(normalizedKey);
    script.addEventListener(
      "error",
      () =>
        finishWithError(
          new BaiduMapError(
            "SDK_REQUEST_FAILED",
            "The Baidu GL SDK request failed. Check the network and browser AK allowlist.",
          ),
        ),
      { once: true },
    );
    script.addEventListener("load", () => {
      logBaiduMapEvent("sdk.bootstrap_loaded", {
        hasBMapGL: hasRequiredBaiduMapConstructors(scope.BMapGL),
      });
      if (hasRequiredBaiduMapConstructors(scope.BMapGL)) finishWithSdk();
    });
    logBaiduMapEvent("sdk.script_injected", {
      endpoint: "https://api.map.baidu.com/api",
      version: "4.0",
    });
    document.head.appendChild(script);
  });

  loaderState = { apiKey: normalizedKey, promise };
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
  if (loaderState) return false;
  document.getElementById(SCRIPT_ID)?.remove();
  const scope = baiduWindow();
  delete scope[BAIDU_MAP_CALLBACK];
  delete scope.BMapGL;
  logBaiduMapEvent("sdk.failure_reset");
  return true;
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

export function waitForBaiduMapRenderer(
  map: BaiduMapInstance,
  container: HTMLElement,
  signal: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    let observer: MutationObserver | null = null;
    const cleanup = () => {
      observer?.disconnect();
      signal.removeEventListener("abort", handleAbort);
    };
    const handleAbort = () => {
      cleanup();
      reject(
        new DOMException(
          "Map renderer initialization was cancelled.",
          "AbortError",
        ),
      );
    };
    const check = () => {
      if (signal.aborted) {
        handleAbort();
        return;
      }
      const canvas = container.querySelector("canvas");
      const rendererIsReady =
        canvas instanceof HTMLCanvasElement &&
        canvas.width > 0 &&
        canvas.height > 0 &&
        (map.isLoaded?.() ?? true);
      if (!rendererIsReady) return;
      cleanup();
      logBaiduMapEvent("renderer.ready", {
        width: canvas.width,
        height: canvas.height,
      });
      resolve();
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    observer = new MutationObserver(check);
    observer.observe(container, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    check();
  });
}
