"use client";

import {
  LoaderCircle,
  Radio,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CallRoomOverlay } from "@/components/features/calls/CallRoomOverlay";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AFRICAN_COUNTRIES } from "@/lib/african-countries";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

type Gender = "MALE" | "FEMALE";
type GenderPreference = "ALL" | Gender;
const POLL_INTERVAL_MS = 2_500;
const AVAILABILITY_WINDOW_MS = 20_000;

export function MeetPanel({ initialGender }: { initialGender: Gender | null }) {
  const [gender, setGender] = useState<Gender | "">(initialGender ?? "");
  const [genderPreference, setGenderPreference] =
    useState<GenderPreference>("ALL");
  const [countryPreferenceCode, setCountryPreferenceCode] = useState("");
  const [matching, setMatching] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [noAvailability, setNoAvailability] = useState(false);
  const pollingRef = useRef(false);
  const requestInFlightRef = useRef(false);
  const pollTimerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);

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

  function start() {
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

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <Card className="overflow-hidden bg-gradient-to-br from-kondo-navy via-kondo-forest to-[#1d7a61] p-8 text-white shadow-lift sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-kondo-lime">
          <Radio className="h-3.5 w-3.5" /> LIVE MEET
        </span>
        <h2 className="mt-6 max-w-md text-3xl font-black tracking-tight sm:text-4xl">
          Meet someone new on Kondo.
        </h2>
        <p className="mt-4 max-w-lg text-sm leading-7 text-white/65">
          Choose who you would like to meet. Kondo only connects mutually
          compatible preferences and never reveals the other person’s choices.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl bg-white/8 p-4">
            <Video className="h-5 w-5 text-kondo-lime" />
            <p className="mt-3 text-sm font-black">Real video</p>
            <p className="mt-1 text-xs leading-5 text-white/55">
              Secure media rooms powered by LiveKit Cloud.
            </p>
          </div>
          <div className="rounded-3xl bg-white/8 p-4">
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
            <h2 className="font-black text-foreground">Matching preferences</h2>
            <p className="text-xs text-muted-foreground">
              Your choices stay private.
            </p>
          </div>
        </div>
        <div className="mt-7 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-foreground">
              I am
            </span>
            <select
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm"
              disabled={matching}
              onChange={(event) => setGender(event.target.value as Gender)}
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
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm"
              disabled={matching}
              onChange={(event) =>
                setGenderPreference(event.target.value as GenderPreference)
              }
              value={genderPreference}
            >
              <option value="ALL">Everyone</option>
              <option value="MALE">Men</option>
              <option value="FEMALE">Women</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-foreground">
              Country
            </span>
            <select
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm"
              disabled={matching}
              onChange={(event) => setCountryPreferenceCode(event.target.value)}
              value={countryPreferenceCode}
            >
              <option value="">All countries</option>
              {AFRICAN_COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.emoji} {country.name}
                </option>
              ))}
            </select>
          </label>
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
              <Button onClick={start} type="button">
                Continue waiting
              </Button>
              <Button onClick={stop} type="button" variant="secondary">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="mt-7"
            fullWidth
            onClick={matching ? stop : start}
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
                <Video className="h-4 w-4" /> Start Matching
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
      {callId ? (
        <CallRoomOverlay
          callId={callId}
          onClose={() => {
            setCallId(null);
            void leaveQueue();
          }}
        />
      ) : null}
    </div>
  );
}
