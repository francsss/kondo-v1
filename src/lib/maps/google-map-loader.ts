"use client";

import {
  importLibrary,
  setOptions,
  type APIOptions,
} from "@googlemaps/js-api-loader";
import { MapProviderError, logMapEvent } from "@/lib/maps/provider";

export type GoogleMapsLibraries = {
  geocoding: google.maps.GeocodingLibrary;
  maps: google.maps.MapsLibrary;
};

type LoaderState = {
  apiKey: string;
  promise: Promise<GoogleMapsLibraries>;
  status: "loading" | "ready" | "failed";
};

type GoogleMapsErrorListener = (error: MapProviderError) => void;
type GoogleMapsWindow = Window &
  typeof globalThis & {
    gm_authFailure?: () => void;
  };

let configuredApiKey = "";
let loaderState: LoaderState | null = null;
let authFailureHandlerInstalled = false;
const errorListeners = new Set<GoogleMapsErrorListener>();

function installAuthenticationFailureHandler() {
  if (typeof window === "undefined" || authFailureHandlerInstalled) return;
  const browserWindow = window as GoogleMapsWindow;
  const previousHandler = browserWindow.gm_authFailure;
  browserWindow.gm_authFailure = () => {
    const error = new MapProviderError(
      "AUTHENTICATION_FAILED",
      "Google Maps rejected the browser key. Check that Maps JavaScript API is enabled and that the HTTP referrer restriction includes this domain.",
    );
    if (loaderState) loaderState.status = "failed";
    console.error("[MeetMap]", "google.sdk.authentication_failed", {
      code: error.code,
      message: error.message,
    });
    for (const listener of errorListeners) listener(error);
    try {
      previousHandler?.();
    } catch (cause) {
      console.error("[MeetMap]", "google.sdk.previous_auth_handler_failed", {
        cause,
      });
    }
  };
  authFailureHandlerInstalled = true;
}

function configureGoogleMaps(apiKey: string) {
  if (configuredApiKey) return;
  installAuthenticationFailureHandler();
  const options: APIOptions = {
    authReferrerPolicy: "origin",
    key: apiKey,
    v: "weekly",
  };
  setOptions(options);
  configuredApiKey = apiKey;
}

export function subscribeToGoogleMapsErrors(listener: GoogleMapsErrorListener) {
  installAuthenticationFailureHandler();
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

function importGoogleLibraries() {
  return Promise.all([
    importLibrary("maps") as Promise<google.maps.MapsLibrary>,
    importLibrary("geocoding") as Promise<google.maps.GeocodingLibrary>,
  ]).then(([maps, geocoding]) => ({ geocoding, maps }));
}

export function loadGoogleMaps(
  rawApiKey: string,
): Promise<GoogleMapsLibraries> {
  const apiKey = rawApiKey.trim();
  if (!apiKey) {
    return Promise.reject(
      new MapProviderError(
        "API_KEY_MISSING",
        "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is empty.",
      ),
    );
  }
  if (configuredApiKey && configuredApiKey !== apiKey) {
    return Promise.reject(
      new MapProviderError(
        "API_KEY_CHANGED",
        "The Google Maps browser API key changed after the SDK was configured.",
      ),
    );
  }
  if (loaderState) return loaderState.promise;

  configureGoogleMaps(apiKey);
  logMapEvent("google.sdk.load_started");
  const promise = importGoogleLibraries()
    .then((libraries) => {
      if (loaderState) loaderState.status = "ready";
      logMapEvent("google.sdk.ready");
      return libraries;
    })
    .catch((cause: unknown) => {
      if (loaderState) loaderState.status = "failed";
      const error =
        cause instanceof MapProviderError
          ? cause
          : new MapProviderError(
              "SDK_LOAD_FAILED",
              cause instanceof Error
                ? `Google Maps could not load: ${cause.message}`
                : "Google Maps could not load.",
            );
      console.error("[MeetMap]", "google.sdk.failed", {
        code: error.code,
        message: error.message,
      });
      throw error;
    });
  loaderState = { apiKey, promise, status: "loading" };
  return promise;
}

export function retryGoogleMapsAfterFailure() {
  if (loaderState?.status !== "failed") return;
  loaderState = null;
  logMapEvent("google.sdk.retry_enabled");
}

export function resetGoogleMapsLoaderForTests() {
  configuredApiKey = "";
  loaderState = null;
  errorListeners.clear();
}
