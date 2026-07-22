"use client";

import {
  ControlBar,
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
} from "@livekit/components-react";
import {
  Ban,
  Flag,
  Headphones,
  LoaderCircle,
  ShieldAlert,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

type CallAccess = {
  token: string;
  serverUrl: string;
  kind: "MEET" | "VIDEO" | "AUDIO";
  otherParticipant: {
    id: string;
    firstName: string;
    lastName: string;
    avatarMediaId: string | null;
  } | null;
};

export function CallRoomOverlay({
  callId,
  onClose,
}: {
  callId: string;
  onClose: () => void;
}) {
  const [access, setAccess] = useState<CallAccess | null>(null);
  const [error, setError] = useState("");
  const [safetyStatus, setSafetyStatus] = useState("");
  const leftRef = useRef(false);

  const presence = useCallback(
    async (status: "JOINED" | "LEFT") => {
      if (status === "LEFT" && leftRef.current) return;
      if (status === "LEFT") leftRef.current = true;
      await fetch(`/api/calls/${callId}/presence`, {
        method: "POST",
        credentials: "include",
        keepalive: status === "LEFT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).catch(() => null);
    },
    [callId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/calls/${callId}/token`, {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(payload?.error ?? "The call could not start.");
        setAccess(payload);
      })
      .catch((reason) => {
        if (reason instanceof Error && reason.name !== "AbortError") {
          setError(reason.message);
        }
      });
    return () => {
      controller.abort();
      void presence("LEFT");
    };
  }, [callId, presence]);

  async function report() {
    if (!access?.otherParticipant) return;
    const details = window.prompt(
      "Tell Kondo what happened. This report is reviewed privately by the safety team.",
    );
    if (details === null) return;
    const response = await fetch(
      `/api/profiles/${access.otherParticipant.id}/report`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "INAPPROPRIATE",
          details: details.trim() || "Reported during a Kondo call.",
        }),
      },
    );
    setSafetyStatus(
      response.ok
        ? "Report sent to the safety team."
        : "The report could not be sent.",
    );
  }

  async function block() {
    if (!access?.otherParticipant) return;
    if (!window.confirm("Block this person and end the call?")) return;
    const response = await fetch(
      `/api/users/${access.otherParticipant.id}/block`,
      { method: "POST", credentials: "include" },
    );
    if (response.ok) {
      await presence("LEFT");
      onClose();
    } else {
      setSafetyStatus("This person could not be blocked.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-kondo-navy text-white"
      data-lk-theme="default"
    >
      {!access && !error ? (
        <div className="grid h-full place-items-center text-center">
          <div>
            <LoaderCircle className="mx-auto h-9 w-9 animate-spin text-kondo-lime" />
            <h2 className="mt-5 text-xl font-black">Connecting…</h2>
            <p className="mt-2 text-sm text-white/60">
              Preparing a secure LiveKit room.
            </p>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="grid h-full place-items-center px-6 text-center">
          <div className="max-w-md">
            <ShieldAlert className="mx-auto h-10 w-10 text-red-300" />
            <h2 className="mt-5 text-xl font-black">Call unavailable</h2>
            <p className="mt-2 text-sm text-white/65">{error}</p>
            <Button className="mt-6" onClick={onClose} type="button">
              Close
            </Button>
          </div>
        </div>
      ) : null}
      {access && !error ? (
        <LiveKitRoom
          audio
          connect
          onConnected={() => void presence("JOINED")}
          onDisconnected={() => {
            void presence("LEFT");
            onClose();
          }}
          onError={(reason) => setError(reason.message)}
          onMediaDeviceFailure={(_failure, kind) =>
            setError(
              `Kondo could not access your ${kind === "audioinput" ? "microphone" : "camera"}. Check the browser permission and try again.`,
            )
          }
          serverUrl={access.serverUrl}
          token={access.token}
          video={access.kind !== "AUDIO"}
        >
          <div className="flex h-full flex-col">
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <p className="truncate font-black">
                  {access.otherParticipant
                    ? `${access.otherParticipant.firstName} ${access.otherParticipant.lastName}`
                    : "Kondo call"}
                </p>
                <p className="text-xs text-white/55">
                  {access.kind === "AUDIO" ? "Audio call" : "Video call"} ·
                  secured by LiveKit
                </p>
              </div>
              <div className="flex items-center gap-1">
                {access.otherParticipant ? (
                  <>
                    <Button
                      aria-label="Report participant"
                      onClick={report}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Flag className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label="Block participant"
                      onClick={block}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Ban className="h-4 w-4" />
                    </Button>
                  </>
                ) : null}
                <Button
                  aria-label="Leave call"
                  onClick={() => {
                    void presence("LEFT");
                    onClose();
                  }}
                  size="icon"
                  type="button"
                  variant="danger"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </header>
            {safetyStatus ? (
              <p className="bg-white/10 px-4 py-2 text-center text-xs font-semibold">
                {safetyStatus}
              </p>
            ) : null}
            <div className="min-h-0 flex-1 overflow-hidden">
              {access.kind === "AUDIO" ? (
                <div className="grid h-full place-items-center px-6 text-center">
                  <div>
                    <span className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-white/10 ring-1 ring-white/15">
                      <Headphones className="h-10 w-10 text-kondo-lime" />
                    </span>
                    <h2 className="mt-6 text-2xl font-black">Audio call</h2>
                    <p className="mt-2 text-sm text-white/55">
                      Live audio is connected. Camera access is disabled for
                      this call.
                    </p>
                    <ControlBar
                      className="mt-8"
                      controls={{
                        camera: false,
                        chat: false,
                        leave: true,
                        microphone: true,
                        screenShare: false,
                        settings: false,
                      }}
                      variation="minimal"
                    />
                  </div>
                </div>
              ) : (
                <VideoConference />
              )}
            </div>
          </div>
          <RoomAudioRenderer />
        </LiveKitRoom>
      ) : null}
    </div>
  );
}
