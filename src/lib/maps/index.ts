"use client";

import { GoogleMapProvider } from "@/lib/maps/google-map-provider";
import type { MapProvider } from "@/lib/maps/provider";

export const MEET_MAP_PROVIDER_ID = "google";
export const MEET_MAP_MISSING_CONFIGURATION_MESSAGE =
  "The real map is not configured yet. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in Vercel Production.";

function googleMapsApiKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
}

export function isMeetMapProviderConfigured() {
  return Boolean(googleMapsApiKey());
}

export function createConfiguredMeetMapProvider(): MapProvider {
  return new GoogleMapProvider(googleMapsApiKey());
}

export type {
  MapController,
  MapCoordinate,
  MapMarkerDefinition,
  MapProvider,
} from "@/lib/maps/provider";
