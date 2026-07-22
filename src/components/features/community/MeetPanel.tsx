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

type Gender = "MALE" | "FEMALE";
type GenderPreference = "ALL" | Gender;

export function MeetPanel({ initialGender }: { initialGender: Gender | null }) {
  const [gender, setGender] = useState<Gender | "">(initialGender ?? "");
  const [genderPreference, setGenderPreference] =
    useState<GenderPreference>("ALL");
  const [countryPreferenceCode, setCountryPreferenceCode] = useState("");
  const [matching, setMatching] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const pollingRef = useRef(false);

  const leaveQueue = useCallback(async () => {
    pollingRef.current = false;
    await fetch("/api/meet/queue", {
      method: "DELETE",
      credentials: "include",
      keepalive: true,
    }).catch(() => null);
  }, []);

  useEffect(() => () => void leaveQueue(), [leaveQueue]);

  async function poll() {
    if (!pollingRef.current || !gender) return;
    const response = await fetch("/api/meet/queue", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gender,
        genderPreference,
        countryPreferenceCode: countryPreferenceCode || null,
      }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
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
      return;
    }
    if (pollingRef.current) window.setTimeout(poll, 2_500);
  }

  function start() {
    if (!gender) {
      setError("Select your gender before starting. It remains private.");
      return;
    }
    setError("");
    setMatching(true);
    pollingRef.current = true;
    void poll();
  }

  async function stop() {
    setMatching(false);
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
