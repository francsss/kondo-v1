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

// Provider-neutral aliases used by domains other than Meet. The Meet exports
// remain stable for backwards compatibility.
export const MAP_PROVIDER_ID = MEET_MAP_PROVIDER_ID;
export const MAP_MISSING_CONFIGURATION_MESSAGE =
  MEET_MAP_MISSING_CONFIGURATION_MESSAGE;
export const isMapProviderConfigured = isMeetMapProviderConfigured;
export const createConfiguredMapProvider = createConfiguredMeetMapProvider;

export type {
  MapController,
  MapCoordinate,
  MapMarkerDefinition,
  MapProvider,
} from "@/lib/maps/provider";
