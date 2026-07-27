"use client";

import {
  Compass,
  LoaderCircle,
  MapPin,
  Radio,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRoundSearch,
  UsersRound,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CallRoomOverlay } from "@/components/features/calls/CallRoomOverlay";
import {
  MeetDiscoveryMap,
  type MeetDiscoveryProfile,
} from "@/components/features/community/MeetDiscoveryMap";
import {
  MeetDiscoveryProfileForm,
  type MeetProfileData,
} from "@/components/features/community/MeetDiscoveryProfileForm";
import { MeetPremiumGate } from "@/components/features/community/MeetPremiumGate";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { MEET_DISTANCE_OPTIONS, MEET_INTENTS } from "@/features/meet/config";
import { AFRICAN_COUNTRIES } from "@/lib/african-countries";
import type { PremiumAccess } from "@/lib/premium";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { cn } from "@/lib/utils";

type Gender = "MALE" | "FEMALE";
type GenderPreference = "ALL" | Gender;
type MeetMode = "RANDOM" | "NEARBY" | "LOOKING_FOR";

const countryOptions = AFRICAN_COUNTRIES.map((country) => ({
  id: country.code,
  name: `${country.emoji} ${country.name}`,
}));
const POLL_INTERVAL_MS = 2_500;
const AVAILABILITY_WINDOW_MS = 20_000;

export function MeetPanel({
  initialGender,
  initialNearbyEnabled,
  initialIntents,
  initialLanguages,
  initialProfile,
  premiumAccess,
  cityName,
  countryName,
  universityName,
  cityOptions,
  universityOptions,
  initialCityId,
  initialUniversityId,
}: {
  initialGender: Gender | null;
  initialNearbyEnabled: boolean;
  initialIntents: string[];
  initialLanguages: string[];
  initialProfile: MeetProfileData | null;
  premiumAccess: PremiumAccess;
  cityName: string | null;
  countryName: string | null;
  universityName: string | null;
  cityOptions: Array<{ id: string; name: string }>;
  universityOptions: Array<{ id: string; name: string; cityId: string }>;
  initialCityId: string | null;
  initialUniversityId: string | null;
}) {
  const hasCompleteDiscoveryProfile = Boolean(
    initialProfile?.completedAt &&
    initialProfile.discoveryCityId &&
    initialProfile.discoveryUniversityId,
  );
  const [profile, setProfile] = useState<MeetProfileData | null>(
    initialProfile,
  );
  const [editingProfile, setEditingProfile] = useState(
    !hasCompleteDiscoveryProfile,
  );
  const [gender, setGender] = useState<Gender | "">(
    initialProfile?.gender ?? initialGender ?? "",
  );
  const [genderPreference, setGenderPreference] = useState<GenderPreference>(
    initialProfile?.interestedIn ?? "ALL",
  );
  const [countryPreferenceCode, setCountryPreferenceCode] = useState("");
  const [mode, setMode] = useState<MeetMode>("RANDOM");
  const [nearbyEnabled, setNearbyEnabled] = useState(
    initialProfile?.nearbyVisibility ?? initialNearbyEnabled,
  );
  const [intents, setIntents] = useState<string[]>(
    initialProfile?.lookingFor.length
      ? initialProfile.lookingFor
      : initialIntents.length
        ? initialIntents
        : MEET_INTENTS.map(([value]) => value),
  );
  const [distanceRange, setDistanceRange] = useState<
    "KM_5" | "KM_10" | "KM_20" | "CITY" | "OTHER_CITY"
  >(
    initialProfile?.distanceRange === "OTHER_CITY"
      ? "CITY"
      : (initialProfile?.distanceRange ?? "CITY"),
  );
  const [matching, setMatching] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryStarted, setDiscoveryStarted] = useState(false);
  const [profiles, setProfiles] = useState<MeetDiscoveryProfile[]>([]);
  const [callId, setCallId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [noAvailability, setNoAvailability] = useState(false);
  const [premiumReason, setPremiumReason] = useState("");
  const pollingRef = useRef(false);
  const requestInFlightRef = useRef(false);
  const pollTimerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const discoveryCityName =
    cityOptions.find((city) => city.id === profile?.discoveryCityId)?.name ??
    cityName;
  const discoveryUniversityName =
    universityOptions.find(
      (university) => university.id === profile?.discoveryUniversityId,
    )?.name ?? universityName;

  useEffect(() => {
    captureProductEvent(PRODUCT_EVENTS.MEET_OPENED);
  }, []);

  const removeFromQueue = useCallback(async () => {
    await fetch("/api/meet/queue", {
      method: "DELETE",
      credentials: "include",
      keepalive: true,
    }).catch(() => null);
  }, []);

  const stopPolling = useCallback(() => {
    pollingRef.current = false;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const leaveQueue = useCallback(async () => {
    stopPolling();
    await removeFromQueue();
  }, [removeFromQueue, stopPolling]);

  useEffect(() => {
    const handlePageHide = () => {
      stopPolling();
      void removeFromQueue();
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      void leaveQueue();
    };
  }, [leaveQueue, removeFromQueue, stopPolling]);

  async function poll() {
    if (!pollingRef.current || !gender || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const response = await fetch("/api/meet/queue", {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gender,
        genderPreference,
        countryPreferenceCode: countryPreferenceCode || null,
        mode: "RANDOM",
        nearbyEnabled: false,
        intents: [],
      }),
    }).catch((reason) => {
      if (reason instanceof Error && reason.name === "AbortError") return null;
      return null;
    });
    const payload = await response?.json().catch(() => null);
    requestInFlightRef.current = false;
    requestControllerRef.current = null;
    if (!pollingRef.current) return;
    if (!response?.ok) {
      pollingRef.current = false;
      setMatching(false);
      setError(payload?.error ?? "Matching is temporarily unavailable.");
      return;
    }
    if (payload.state === "MATCHED") {
      pollingRef.current = false;
      setMatching(false);
      setCallId(payload.callId);
      captureProductEvent(PRODUCT_EVENTS.MEET_MATCHED, {
        wait_seconds: Math.round((Date.now() - startedAtRef.current) / 1_000),
        country_filter: countryPreferenceCode || "all",
      });
      captureProductEvent(PRODUCT_EVENTS.MEET_CONVERSATION_STARTED, {
        channel: "video",
      });
      return;
    }
    if (payload.state === "BUSY") {
      pollingRef.current = false;
      setMatching(false);
      setError("You are already connected to another active call.");
      return;
    }
    if (Date.now() - startedAtRef.current >= AVAILABILITY_WINDOW_MS) {
      pollingRef.current = false;
      setMatching(false);
      setNoAvailability(true);
      await removeFromQueue();
      return;
    }
    if (pollingRef.current) {
      pollTimerRef.current = window.setTimeout(
        () => void poll(),
        POLL_INTERVAL_MS,
      );
    }
  }

  function startRandomMatch() {
    if (!gender) {
      setError("Select your gender before starting. It remains private.");
      return;
    }
    if (pollingRef.current || requestInFlightRef.current) return;
    setError("");
    setNoAvailability(false);
    setMatching(true);
    pollingRef.current = true;
    startedAtRef.current = Date.now();
    captureProductEvent(PRODUCT_EVENTS.MEET_PROFILE_VIEWED, {
      stage: "matching_preferences",
    });
    void poll();
  }

  async function stop() {
    setMatching(false);
    setNoAvailability(false);
    await leaveQueue();
  }

  async function discoverPeople() {
    if (mode === "NEARBY" && !nearbyEnabled) {
      setError("Enable approximate nearby discovery to continue.");
      return;
    }
    if (mode === "LOOKING_FOR" && !intents.length) {
      setError("Choose at least one reason for meeting.");
      return;
    }
    if (discovering) return;
    setDiscovering(true);
    setError("");
    try {
      const response = await fetch("/api/meet/discovery", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          genderPreference,
          countryPreferenceCode,
          intents,
          distanceRange,
          otherCityId: null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (payload?.code === "MEET_PREMIUM_REQUIRED") {
          setPremiumReason(payload.error);
          return;
        }
        throw new Error(
          payload?.error ?? "Discovery is temporarily unavailable.",
        );
      }
      setProfiles(payload.profiles ?? []);
      setDiscoveryStarted(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Discovery is temporarily unavailable.",
      );
    } finally {
      setDiscovering(false);
    }
  }

  function selectMode(nextMode: MeetMode) {
    if (matching) return;
    setMode(nextMode);
    setError("");
    setNoAvailability(false);
    setDiscoveryStarted(false);
    setProfiles([]);
    if (nextMode !== "RANDOM") void leaveQueue();
  }

  function savedProfile(nextProfile: MeetProfileData) {
    setProfile(nextProfile);
    setGender(nextProfile.gender);
    setGenderPreference(nextProfile.interestedIn);
    setNearbyEnabled(nextProfile.nearbyVisibility);
    setIntents(nextProfile.lookingFor);
    setDistanceRange(
      nextProfile.distanceRange === "OTHER_CITY"
        ? "CITY"
        : nextProfile.distanceRange,
    );
    setEditingProfile(false);
    setDiscoveryStarted(false);
    setProfiles([]);
  }

  const profileIsComplete = Boolean(
    profile?.completedAt &&
    profile.discoveryCityId &&
    profile.discoveryUniversityId,
  );

  if (editingProfile || !profileIsComplete) {
    return (
      <MeetDiscoveryProfileForm
        cityOptions={cityOptions}
        currentCity={cityName}
        currentCountry={countryName}
        currentUniversity={universityName}
        initialCityId={initialCityId}
        initialGender={initialGender}
        initialLanguages={initialLanguages}
        initialUniversityId={initialUniversityId}
        onCancel={
          profileIsComplete ? () => setEditingProfile(false) : undefined
        }
        onSaved={savedProfile}
        profile={profile}
        required={!profileIsComplete}
        universityOptions={universityOptions}
      />
    );
  }

  return (
    <>
      <div className="mx-auto mb-4 flex max-w-5xl items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
            Student discovery
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your preferences stay private and can be changed anytime.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setEditingProfile(true)}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Settings2 className="h-4 w-4" />
            Discovery Settings
          </Button>
        </div>
      </div>
      <nav
        aria-label="Meet modes"
        className="subnav-row mx-auto mb-7 max-w-5xl border-b border-border"
      >
        {[
          { value: "RANDOM" as const, label: "Random", icon: Radio },
          { value: "NEARBY" as const, label: "Nearby", icon: MapPin },
          {
            value: "LOOKING_FOR" as const,
            label: "Looking For",
            icon: UsersRound,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              aria-pressed={mode === item.value}
              className={cn(
                "relative inline-flex min-h-14 items-center justify-center gap-2 px-2 text-xs transition sm:px-5 sm:text-sm",
                mode === item.value
                  ? "font-black text-kondo-green after:absolute after:inset-x-5 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-kondo-green"
                  : "font-bold text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
              disabled={matching}
              key={item.value}
              onClick={() => selectMode(item.value)}
              type="button"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {mode === "RANDOM" ? (
        <RandomMeet
          countryPreferenceCode={countryPreferenceCode}
          error={error}
          gender={gender}
          genderPreference={genderPreference}
          matching={matching}
          noAvailability={noAvailability}
          onCountryChange={setCountryPreferenceCode}
          onGenderChange={setGender}
          onGenderPreferenceChange={setGenderPreference}
          onStart={startRandomMatch}
          onStop={stop}
        />
      ) : (
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
            <Card className="h-fit p-6 sm:p-7">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
                {mode === "NEARBY" ? (
                  <MapPin className="h-5 w-5" />
                ) : (
                  <Compass className="h-5 w-5" />
                )}
              </span>
              <h2 className="mt-5 text-2xl font-black tracking-tight">
                {mode === "NEARBY"
                  ? "Discover your Kondo neighborhood"
                  : "Find people on your wavelength"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {mode === "NEARBY"
                  ? `Explore members who opted in around ${
                      discoveryUniversityName ??
                      discoveryCityName ??
                      "your study area"
                    }. Markers are decorative and never represent exact positions.`
                  : "Choose what brings you here, then explore compatible profiles without starting an automatic call."}
              </p>

              <div className="mt-6 space-y-5">
                {mode === "NEARBY" ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4">
                    <span>
                      <span className="flex items-center gap-2 text-sm font-black">
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            nearbyEnabled
                              ? "bg-kondo-green"
                              : "bg-muted-foreground/40",
                          )}
                        />
                        Approximate discovery{" "}
                        {nearbyEnabled ? "enabled" : "disabled"}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        Manage this preference in Discovery Settings. Your exact
                        position is never requested or shared.
                      </span>
                    </span>
                  </div>
                ) : (
                  <fieldset>
                    <legend className="mb-2 text-sm font-bold text-foreground">
                      I’m looking for
                    </legend>
                    <div className="grid grid-cols-2 gap-2">
                      {MEET_INTENTS.map(([value, label]) => {
                        const selected = intents.includes(value);
                        return (
                          <button
                            aria-pressed={selected}
                            className={cn(
                              "rounded-2xl border p-3 text-left text-xs transition active:scale-[0.98]",
                              selected
                                ? "border-kondo-green bg-kondo-mint font-black text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
                                : "border-border font-bold text-muted-foreground hover:border-kondo-green/40 hover:bg-muted/60",
                            )}
                            key={value}
                            onClick={() =>
                              setIntents((current) =>
                                selected
                                  ? current.filter((item) => item !== value)
                                  : [...current, value],
                              )
                            }
                            type="button"
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                )}

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-foreground">
                    Show me
                  </span>
                  <select
                    className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-kondo-green focus:ring-4 focus:ring-kondo-green/10"
                    onChange={(event) =>
                      setGenderPreference(
                        event.target.value as GenderPreference,
                      )
                    }
                    value={genderPreference}
                  >
                    <option value="ALL">Everyone</option>
                    <option value="MALE">Men</option>
                    <option value="FEMALE">Women</option>
                  </select>
                </label>

                <SearchableSelect
                  clearLabel="All African countries"
                  label="Country"
                  onSelect={setCountryPreferenceCode}
                  options={countryOptions}
                  placeholder="All African countries"
                  searchPlaceholder="Search countries"
                  selected={countryPreferenceCode}
                />

                {mode === "NEARBY" ? (
                  <fieldset>
                    <legend className="mb-2 text-sm font-bold text-foreground">
                      Discovery area
                    </legend>
                    <div className="grid grid-cols-2 gap-2">
                      {MEET_DISTANCE_OPTIONS.filter(
                        (option) => option.value !== "OTHER_CITY",
                      ).map((option) => (
                        <button
                          aria-pressed={distanceRange === option.value}
                          className={cn(
                            "rounded-2xl border p-3 text-left text-xs transition active:scale-[0.98]",
                            distanceRange === option.value
                              ? "border-kondo-green bg-kondo-mint font-black text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
                              : "border-border font-bold text-muted-foreground hover:border-kondo-green/40",
                          )}
                          key={option.value}
                          onClick={() => setDistanceRange(option.value)}
                          type="button"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ) : null}

                {error ? (
                  <p
                    className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}

                <Button
                  disabled={discovering}
                  fullWidth
                  onClick={discoverPeople}
                  size="lg"
                  type="button"
                >
                  {discovering ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserRoundSearch className="h-4 w-4" />
                  )}
                  {discovering
                    ? "Discovering…"
                    : discoveryStarted
                      ? "Refresh discovery"
                      : "Explore people"}
                </Button>
              </div>
            </Card>

            {discoveryStarted ? (
              <MeetDiscoveryMap
                areaLabel={
                  mode === "NEARBY"
                    ? `Around ${
                        discoveryUniversityName ??
                        discoveryCityName ??
                        "your study area"
                      }`
                    : "Your discovery constellation"
                }
                mode={mode}
                onPremiumRequest={setPremiumReason}
                premiumFeatures={premiumAccess.featureKeys}
                profiles={profiles}
              />
            ) : (
              <section className="relative min-h-[430px] overflow-hidden rounded-[2rem] border border-dashed border-border bg-gradient-to-br from-kondo-mint/60 via-card to-muted/50 p-8 dark:from-emerald-400/5">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,rgba(52,211,153,.18),transparent_22%),radial-gradient(circle_at_75%_65%,rgba(45,212,191,.14),transparent_25%)]"
                />
                <div className="relative grid h-full min-h-[360px] place-items-center text-center">
                  <div className="max-w-md">
                    <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-card text-kondo-green shadow-xl">
                      <Sparkles className="h-7 w-7" />
                    </span>
                    <h3 className="mt-5 text-2xl font-black tracking-tight">
                      Your map begins with your choices
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      Set the filters that matter to you. Kondo will place
                      compatible profiles on a stylized privacy-first map—never
                      their real coordinates.
                    </p>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {callId ? (
        <CallRoomOverlay
          callId={callId}
          onClose={() => {
            setCallId(null);
            void leaveQueue();
          }}
        />
      ) : null}
      <MeetPremiumGate
        onClose={() => setPremiumReason("")}
        open={Boolean(premiumReason)}
        reason={premiumReason}
      />
    </>
  );
}

function RandomMeet({
  gender,
  genderPreference,
  countryPreferenceCode,
  matching,
  noAvailability,
  error,
  onGenderChange,
  onGenderPreferenceChange,
  onCountryChange,
  onStart,
  onStop,
}: {
  gender: Gender | "";
  genderPreference: GenderPreference;
  countryPreferenceCode: string;
  matching: boolean;
  noAvailability: boolean;
  error: string;
  onGenderChange: (value: Gender) => void;
  onGenderPreferenceChange: (value: GenderPreference) => void;
  onCountryChange: (value: string) => void;
  onStart: () => void;
  onStop: () => Promise<void>;
}) {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <Card className="overflow-hidden bg-gradient-to-br from-kondo-navy via-kondo-forest to-[#1d7a61] p-8 text-white shadow-lift sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-kondo-lime">
          <Radio className="h-3.5 w-3.5" /> INSTANT RANDOM MEET
        </span>
        <h2 className="mt-6 max-w-md text-3xl font-black tracking-tight sm:text-4xl">
          Meet someone new, right now.
        </h2>
        <p className="mt-4 max-w-lg text-sm leading-7 text-white/65">
          Random is the only Meet mode that starts an instant video match.
          Preferences are checked in both directions and never revealed.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl bg-white/8 p-4 transition hover:bg-white/12">
            <Video className="h-5 w-5 text-kondo-lime" />
            <p className="mt-3 text-sm font-black">Real video</p>
            <p className="mt-1 text-xs leading-5 text-white/55">
              Secure media rooms powered by LiveKit Cloud.
            </p>
          </div>
          <div className="rounded-3xl bg-white/8 p-4 transition hover:bg-white/12">
            <ShieldCheck className="h-5 w-5 text-kondo-lime" />
            <p className="mt-3 text-sm font-black">Safety first</p>
            <p className="mt-1 text-xs leading-5 text-white/55">
              Block, report, or leave instantly at any time.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-black text-foreground">
              Private matching preferences
            </h2>
            <p className="text-xs text-muted-foreground">
              Used for matching only.
            </p>
          </div>
        </div>
        <div className="mt-7 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-foreground">
              I am
            </span>
            <select
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-kondo-green focus:ring-4 focus:ring-kondo-green/10"
              disabled={matching}
              onChange={(event) => onGenderChange(event.target.value as Gender)}
              value={gender}
            >
              <option disabled value="">
                Select privately
              </option>
              <option value="MALE">Man</option>
              <option value="FEMALE">Woman</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-foreground">
              Meet
            </span>
            <select
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-kondo-green focus:ring-4 focus:ring-kondo-green/10"
              disabled={matching}
              onChange={(event) =>
                onGenderPreferenceChange(event.target.value as GenderPreference)
              }
              value={genderPreference}
            >
              <option value="ALL">Everyone</option>
              <option value="MALE">Men</option>
              <option value="FEMALE">Women</option>
            </select>
          </label>
          <SearchableSelect
            clearLabel="All African countries"
            disabled={matching}
            label="Country"
            onSelect={onCountryChange}
            options={countryOptions}
            placeholder="All African countries"
            searchPlaceholder="Search countries"
            selected={countryPreferenceCode}
          />
        </div>
        {error ? (
          <p
            className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-400/10 dark:text-red-300"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {noAvailability ? (
          <div className="mt-7 rounded-2xl border border-border bg-muted/45 p-4">
            <p className="text-sm font-black text-foreground">
              No one is available right now.
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              You can keep waiting with the same private preferences or cancel.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button onClick={onStart} type="button">
                Continue waiting
              </Button>
              <Button onClick={onStop} type="button" variant="secondary">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="mt-7"
            fullWidth
            onClick={matching ? onStop : onStart}
            size="lg"
            type="button"
            variant={matching ? "secondary" : "primary"}
          >
            {matching ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" /> Looking for a
                match…
              </>
            ) : (
              <>
                <Video className="h-4 w-4" /> Start Random Matching
              </>
            )}
          </Button>
        )}
        {matching ? (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Keep this page open. You will connect automatically.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
