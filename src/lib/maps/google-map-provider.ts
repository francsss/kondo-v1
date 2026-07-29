"use client";

import {
  loadGoogleMaps,
  retryGoogleMapsAfterFailure,
  subscribeToGoogleMapsErrors,
  type GoogleMapsLibraries,
} from "@/lib/maps/google-map-loader";
import {
  logMapEvent,
  MapProviderError,
  type MapController,
  type MapCoordinate,
  type MapCreateOptions,
  type MapMarkerDefinition,
  type MapProvider,
  type MapViewport,
} from "@/lib/maps/provider";

const GOOGLE_MAP_STYLES: google.maps.MapTypeStyle[] = [
  {
    featureType: "poi.business",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.school",
    elementType: "labels.icon",
    stylers: [{ color: "#16a36a" }],
  },
  {
    featureType: "transit",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
];

function createMarkerElement(marker: MapMarkerDefinition) {
  const button = document.createElement("button");
  button.className = `meet-map-marker meet-map-marker--${marker.variant}`;
  button.type = "button";
  button.title = marker.title;
  button.setAttribute("aria-label", marker.title);

  const beacon = document.createElement("span");
  beacon.className = "meet-map-marker__beacon";
  beacon.setAttribute("aria-hidden", "true");
  beacon.append(
    Object.assign(document.createElement("span"), {
      className: "meet-map-marker__wave meet-map-marker__wave--one",
    }),
    Object.assign(document.createElement("span"), {
      className: "meet-map-marker__wave meet-map-marker__wave--two",
    }),
  );

  const core = document.createElement("span");
  core.className = "meet-map-marker__core";
  if (marker.avatarUrl) {
    const image = document.createElement("img");
    image.alt = "";
    image.decoding = "async";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.src = marker.avatarUrl;
    image.addEventListener(
      "error",
      () => {
        image.remove();
        core.textContent = marker.label.slice(0, 1).toUpperCase();
      },
      { once: true },
    );
    core.append(image);
  } else {
    core.textContent =
      marker.variant === "university"
        ? "U"
        : marker.label.slice(0, 1).toUpperCase();
  }
  beacon.append(core);
  button.append(beacon);

  const caption = document.createElement("span");
  caption.className = "meet-map-marker__caption";
  const name = document.createElement("strong");
  name.textContent = marker.label;
  caption.append(name);
  if (marker.distanceLabel) {
    const distance = document.createElement("span");
    distance.textContent = marker.distanceLabel;
    caption.append(distance);
  }
  button.append(caption);
  if (marker.onClick) button.addEventListener("click", marker.onClick);
  return button;
}

function createPresenceOverlayClass() {
  return class PresenceOverlay extends google.maps.OverlayView {
    private readonly coordinate: MapCoordinate;
    private readonly element: HTMLButtonElement;

    constructor(marker: MapMarkerDefinition) {
      super();
      this.coordinate = marker.coordinate;
      this.element = createMarkerElement(marker);
    }

    override onAdd() {
      this.getPanes()?.overlayMouseTarget.append(this.element);
    }

    override draw() {
      const projection = this.getProjection();
      const point = projection.fromLatLngToDivPixel(this.coordinate);
      if (!point) return;
      this.element.style.left = `${Math.round(point.x)}px`;
      this.element.style.top = `${Math.round(point.y)}px`;
    }

    override onRemove() {
      this.element.remove();
    }
  };
}

class GoogleMapController implements MapController {
  private circle: google.maps.Circle | null = null;
  private markerOverlays: google.maps.OverlayView[] = [];
  private readonly readyListener: google.maps.MapsEventListener;
  private destroyed = false;

  constructor(
    private readonly map: google.maps.Map,
    options: MapCreateOptions,
    private readonly unsubscribeFromErrors: () => void,
  ) {
    this.readyListener = google.maps.event.addListenerOnce(
      map,
      "tilesloaded",
      () => {
        if (this.destroyed) return;
        logMapEvent("google.map.tiles_loaded");
        options.onReady?.();
      },
    );
  }

  setViewport(viewport: MapViewport) {
    if (this.destroyed) return;
    this.map.setCenter(viewport.center);
    this.map.setZoom(viewport.zoom);
  }

  setRadius(center: MapCoordinate, radiusMeters: number) {
    if (this.destroyed) return;
    this.circle?.setMap(null);
    this.circle = new google.maps.Circle({
      center,
      clickable: false,
      fillColor: "#34d399",
      fillOpacity: 0.08,
      map: this.map,
      radius: radiusMeters,
      strokeColor: "#16a36a",
      strokeOpacity: 0.52,
      strokeWeight: 1,
    });
  }

  setMarkers(markers: MapMarkerDefinition[]) {
    if (this.destroyed) return;
    for (const overlay of this.markerOverlays) overlay.setMap(null);
    const PresenceOverlay = createPresenceOverlayClass();
    this.markerOverlays = markers.map((marker) => {
      const overlay = new PresenceOverlay(marker);
      overlay.setMap(this.map);
      return overlay;
    });
    logMapEvent("google.markers.rendered", {
      count: this.markerOverlays.length,
    });
  }

  resize() {
    if (this.destroyed) return;
    google.maps.event.trigger(this.map, "resize");
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.readyListener.remove();
    this.unsubscribeFromErrors();
    this.circle?.setMap(null);
    this.circle = null;
    for (const overlay of this.markerOverlays) overlay.setMap(null);
    this.markerOverlays = [];
    google.maps.event.clearInstanceListeners(this.map);
    logMapEvent("google.map.destroyed");
  }
}

export class GoogleMapProvider implements MapProvider {
  readonly id = "google";
  private libraries: GoogleMapsLibraries | null = null;

  constructor(private readonly apiKey: string) {}

  private async load() {
    this.libraries ??= await loadGoogleMaps(this.apiKey);
    return this.libraries;
  }

  async createMap(container: HTMLElement, options: MapCreateOptions) {
    const unsubscribeFromErrors = subscribeToGoogleMapsErrors((error) => {
      options.onError?.(error);
    });
    try {
      const { maps } = await this.load();
      if (typeof maps.Map !== "function") {
        throw new MapProviderError(
          "SDK_LOAD_FAILED",
          "Google Maps loaded without the Maps constructor.",
        );
      }
      container.replaceChildren();
      const map = new maps.Map(container, {
        center: options.center,
        clickableIcons: false,
        disableDefaultUI: true,
        fullscreenControl: false,
        gestureHandling: "greedy",
        mapTypeControl: false,
        rotateControl: false,
        scaleControl: true,
        streetViewControl: false,
        styles: GOOGLE_MAP_STYLES,
        zoom: options.zoom,
        zoomControl: true,
      });
      logMapEvent("google.map.created", {
        lat: options.center.lat,
        lng: options.center.lng,
        zoom: options.zoom,
      });
      return new GoogleMapController(map, options, unsubscribeFromErrors);
    } catch (cause) {
      unsubscribeFromErrors();
      if (cause instanceof MapProviderError) throw cause;
      throw new MapProviderError(
        "MAP_INITIALIZATION_FAILED",
        cause instanceof Error
          ? `Google Maps could not initialize: ${cause.message}`
          : "Google Maps could not initialize.",
      );
    }
  }

  async geocode(queries: string[]) {
    const { geocoding } = await this.load();
    const geocoder = new geocoding.Geocoder();
    const uniqueQueries = [...new Set(queries.map((query) => query.trim()))]
      .filter(Boolean)
      .slice(0, 6);
    for (const query of uniqueQueries) {
      try {
        const response = await geocoder.geocode({
          address: query,
          componentRestrictions: { country: "CN" },
          region: "CN",
        });
        const location = response.results[0]?.geometry.location;
        if (location) {
          logMapEvent("google.geocoder.resolved", { query });
          return location.toJSON();
        }
      } catch (error) {
        console.error("[MeetMap]", "google.geocoder.failed", { error, query });
      }
    }
    return null;
  }

  retryAfterFailure() {
    this.libraries = null;
    retryGoogleMapsAfterFailure();
  }
}
