"use client";

export type MapCoordinate = {
  lat: number;
  lng: number;
};

export type MapMarkerVariant = "current" | "member" | "university" | "housing";

export type MapMarkerDefinition = {
  id: string;
  coordinate: MapCoordinate;
  title: string;
  label: string;
  distanceLabel?: string;
  avatarUrl?: string;
  variant: MapMarkerVariant;
  onClick?: () => void;
};

export type MapViewport = {
  center: MapCoordinate;
  zoom: number;
};

export type MapCreateOptions = MapViewport & {
  onError?: (error: Error) => void;
  onReady?: () => void;
};

export interface MapController {
  setViewport(viewport: MapViewport): void;
  setRadius(center: MapCoordinate, radiusMeters: number): void;
  setMarkers(markers: MapMarkerDefinition[]): void;
  resize(): void;
  destroy(): void;
}

export interface MapProvider {
  readonly id: string;
  createMap(
    container: HTMLElement,
    options: MapCreateOptions,
  ): Promise<MapController>;
  geocode(queries: string[]): Promise<MapCoordinate | null>;
  retryAfterFailure(): void;
}

export type MapProviderErrorCode =
  | "API_KEY_MISSING"
  | "API_KEY_CHANGED"
  | "AUTHENTICATION_FAILED"
  | "SDK_LOAD_FAILED"
  | "MAP_CONTAINER_INVALID"
  | "MAP_INITIALIZATION_FAILED";

export class MapProviderError extends Error {
  constructor(
    public readonly code: MapProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MapProviderError";
  }
}

export function logMapEvent(
  event: string,
  details: Record<string, unknown> = {},
) {
  if (process.env.NODE_ENV !== "production") {
    console.info("[MeetMap]", event, details);
  }
}

function measurement(container: HTMLElement) {
  const bounds = container.getBoundingClientRect();
  const styles = window.getComputedStyle(container);
  return {
    connected: container.isConnected,
    display: styles.display,
    height: bounds.height,
    visibility: styles.visibility,
    width: bounds.width,
  };
}

export function waitForMapContainer(
  container: HTMLElement,
  signal: AbortSignal,
  timeoutMs = 10_000,
) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    let animationFrame = 0;
    let timeout = 0;
    let observer: ResizeObserver | null = null;

    const cleanup = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (timeout) window.clearTimeout(timeout);
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
      const current = measurement(container);
      if (
        current.connected &&
        current.width > 0 &&
        current.height > 0 &&
        current.display !== "none" &&
        current.visibility !== "hidden"
      ) {
        cleanup();
        logMapEvent("container.ready", {
          height: Math.round(current.height),
          width: Math.round(current.width),
        });
        resolve({ height: current.height, width: current.width });
        return;
      }
      animationFrame = window.requestAnimationFrame(check);
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    if (typeof ResizeObserver === "function") {
      observer = new ResizeObserver(check);
      observer.observe(container);
    }
    timeout = window.setTimeout(() => {
      const current = measurement(container);
      cleanup();
      reject(
        new MapProviderError(
          "MAP_CONTAINER_INVALID",
          `The map container never became visible at a usable size (${Math.round(current.width)}×${Math.round(current.height)}).`,
        ),
      );
    }, timeoutMs);
    check();
  });
}
