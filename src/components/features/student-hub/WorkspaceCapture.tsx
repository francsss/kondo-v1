"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  FileText,
  ListTodo,
  Loader2,
  Mic,
  PenLine,
  Plus,
  Square,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { uploadMediaFile } from "@/lib/client-media";
import { cn } from "@/lib/utils";

/**
 * The one primary action of a course Workspace, and everything else folded
 * behind a single `+ Add`.
 *
 * The brief is explicit that Write Note, Voice Note, Photo, Document and Task
 * must not sit on the screen at once, so one control opens a small menu and
 * each choice replaces it with just the surface that choice needs.
 *
 * The course is already known, so the student is never asked which course this
 * belongs to. A task goes to `POST /api/student-hub/tasks` — the same endpoint
 * the Planner uses, which is what makes it appear in Planner → Tasks without a
 * second task system existing. Everything else goes to
 * `POST /api/student-hub/workspace/captures`, with any file uploaded first
 * through the existing media pipeline so bytes are validated before a row
 * points at them.
 */

type Mode = null | "menu" | "task" | "note" | "voice";

const AUDIO_MIME = "audio/webm";

/**
 * Voice notes need `MediaRecorder` and a WebM encoder. Reading that during
 * render would disagree with the server, so it is read as an external store:
 * the server and the first client render both say "no", and the button appears
 * on the pass right after hydration where it is actually usable.
 */
function subscribeNothing() {
  return () => {};
}
function canRecordVoice() {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    MediaRecorder.isTypeSupported(AUDIO_MIME)
  );
}

export function WorkspaceCapture({
  courseId,
  courseName,
  resume = null,
}: {
  courseId: string;
  courseName: string;
  /** The book this course is being read from, if one is linked. */
  resume?: { slug: string; title: string; chapterLabel: string | null } | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const documentInput = useRef<HTMLInputElement>(null);

  const voiceSupported = useSyncExternalStore(
    subscribeNothing,
    canRecordVoice,
    () => false,
  );

  const confirm = useCallback(
    (message: string) => {
      setSaved(message);
      setMode(null);
      setText("");
      // The list on this page is server-rendered, so ask for it again rather
      // than keeping a second copy of the capture in client state.
      router.refresh();
      window.setTimeout(() => setSaved(""), 2400);
    },
    [router],
  );

  async function postCapture(payload: {
    kind: "NOTE" | "PHOTO" | "DOCUMENT" | "VOICE";
    body?: string;
    mediaId?: string;
  }) {
    const response = await fetch("/api/student-hub/workspace/captures", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, ...payload }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(body.error ?? "That was not saved.");
    }
  }

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy("task");
    setError("");
    try {
      const response = await fetch("/api/student-hub/tasks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, title: trimmed }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? "The task was not saved.");
        return;
      }
      confirm("Added to Planner");
    } catch {
      setError("The task was not saved.");
    } finally {
      setBusy("");
    }
  }

  async function saveNote(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy("note");
    setError("");
    try {
      await postCapture({ kind: "NOTE", body: trimmed });
      confirm("Note saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That was not saved.");
    } finally {
      setBusy("");
    }
  }

  async function saveFile(file: File, kind: "PHOTO" | "DOCUMENT" | "VOICE") {
    setBusy(kind);
    setError("");
    try {
      const mediaId = await uploadMediaFile(file, {
        purpose:
          kind === "PHOTO"
            ? "COURSE_CAPTURE_IMAGE"
            : kind === "DOCUMENT"
              ? "COURSE_CAPTURE_DOCUMENT"
              : "COURSE_CAPTURE_AUDIO",
      });
      await postCapture({ kind, mediaId });
      confirm(
        kind === "PHOTO"
          ? "Photo saved"
          : kind === "DOCUMENT"
            ? "Document saved"
            : "Voice note saved",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That was not saved.");
    } finally {
      setBusy("");
    }
  }

  function pickFile(
    event: React.ChangeEvent<HTMLInputElement>,
    kind: "PHOTO" | "DOCUMENT",
  ) {
    const file = event.target.files?.[0];
    // Reset first, so choosing the same file twice still fires a change.
    event.target.value = "";
    if (file) void saveFile(file, kind);
  }

  return (
    <div className="mt-6">
      {/*
       * The primary action follows the work. With a book linked it resumes
       * that book at the saved chapter; without one there is nothing honest to
       * continue, so `+ Add` becomes the way forward instead of a button that
       * leads nowhere.
       */}
      {resume ? (
        <Link
          className="mb-2 flex items-center gap-3 rounded-2xl border border-kondo-green/40 bg-kondo-mint p-3.5 transition active:scale-[0.99] dark:bg-emerald-400/10 motion-reduce:active:scale-100"
          href={`/student-hub/essentials/read/${resume.slug}`}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black text-foreground">
              {resume.title}
            </span>
            {resume.chapterLabel ? (
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {resume.chapterLabel}
              </span>
            ) : null}
          </span>
          <span className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-kondo-green px-4 text-xs font-black text-white">
            {resume.chapterLabel ? "Continue reading" : "Start reading"}
          </span>
        </Link>
      ) : null}

      {/*
       * One control, not two. A wide button and a `+` that open the same menu
       * read as two different offers and leave the student guessing which one
       * is the real one.
       *
       * Its weight follows what the screen is for. With no book to resume this
       * is the only thing to do here, so it is solid; when there is reading to
       * continue that becomes the primary action and this steps back to an
       * outline rather than competing with it.
       */}
      <button
        aria-expanded={mode !== null}
        className={cn(
          "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-black transition active:scale-[0.99] motion-reduce:active:scale-100",
          mode
            ? "border border-kondo-green bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300"
            : resume
              ? "border border-border bg-card text-foreground hover:border-kondo-green/40"
              : "bg-kondo-green text-white",
        )}
        onClick={() => setMode((value) => (value ? null : "menu"))}
        type="button"
      >
        {mode ? (
          <X aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Plus aria-hidden="true" className="h-4 w-4" />
        )}
        {mode ? "Close" : "Add to this course"}
      </button>

      {saved ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-kondo-forest dark:text-emerald-300">
          <Check aria-hidden="true" className="h-3.5 w-3.5" />
          {saved}
        </p>
      ) : null}

      {busy && mode === null ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
          <Loader2
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
          />
          Saving…
        </p>
      ) : null}

      {/* Hidden inputs: the camera and file picker are the operating system's,
          so Kondo does not draw a second one. */}
      <input
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        onChange={(event) => pickFile(event, "PHOTO")}
        ref={photoInput}
        type="file"
      />
      <input
        accept="application/pdf"
        className="sr-only"
        onChange={(event) => pickFile(event, "DOCUMENT")}
        ref={documentInput}
        type="file"
      />

      {mode === "menu" ? (
        <div className="animate-sheet-in mt-3 grid grid-cols-2 gap-2 motion-reduce:animate-none xs:grid-cols-3">
          <MenuButton
            icon={PenLine}
            label="Note"
            onClick={() => setMode("note")}
          />
          <MenuButton
            icon={ListTodo}
            label="Task"
            onClick={() => setMode("task")}
          />
          <MenuButton
            busy={busy === "PHOTO"}
            icon={Camera}
            label="Photo"
            onClick={() => photoInput.current?.click()}
          />
          <MenuButton
            busy={busy === "DOCUMENT"}
            icon={FileText}
            label="Document"
            onClick={() => documentInput.current?.click()}
          />
          {/* Shown only where the browser can actually record it. */}
          {voiceSupported ? (
            <MenuButton
              icon={Mic}
              label="Voice note"
              onClick={() => setMode("voice")}
            />
          ) : null}
        </div>
      ) : null}

      {mode === "task" || mode === "note" ? (
        <form
          className="animate-sheet-in mt-3 rounded-2xl border border-border bg-card p-3 motion-reduce:animate-none"
          onSubmit={mode === "task" ? createTask : saveNote}
        >
          <label className="flex items-center gap-2">
            {mode === "task" ? (
              <ListTodo
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-kondo-green"
              />
            ) : (
              <PenLine
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-kondo-green"
              />
            )}
            <span className="sr-only">
              {mode === "task" ? "Task" : "Note"} for {courseName}
            </span>
            <input
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              enterKeyHint="done"
              maxLength={mode === "task" ? 200 : 4000}
              onChange={(event) => setText(event.target.value)}
              placeholder={
                mode === "task"
                  ? `Add a task for ${courseName}`
                  : `Note for ${courseName}`
              }
              value={text}
            />
            <button
              className="inline-flex min-h-9 shrink-0 items-center rounded-full bg-kondo-green px-3.5 text-xs font-black text-white disabled:opacity-50"
              disabled={!text.trim() || Boolean(busy)}
              type="submit"
            >
              {busy ? (
                <Loader2
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                />
              ) : (
                "Save"
              )}
            </button>
          </label>
          {error ? (
            <p className="mt-2 text-xs font-bold text-destructive">{error}</p>
          ) : null}
        </form>
      ) : null}

      {mode === "voice" ? (
        <VoiceRecorder
          busy={busy === "VOICE"}
          onCancel={() => setMode("menu")}
          onRecorded={(file) => void saveFile(file, "VOICE")}
        />
      ) : null}

      {error && mode === null ? (
        <p className="mt-2 text-xs font-bold text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  busy = false,
}: {
  icon: typeof PenLine;
  label: string;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card px-2 text-center transition hover:border-kondo-green/40 active:scale-[0.98] disabled:opacity-60 motion-reduce:active:scale-100"
      disabled={busy}
      onClick={onClick}
      type="button"
    >
      {busy ? (
        <Loader2
          aria-hidden="true"
          className="h-5 w-5 animate-spin text-kondo-green motion-reduce:animate-none"
        />
      ) : (
        <Icon aria-hidden="true" className="h-5 w-5 text-kondo-green" />
      )}
      <span className="text-xs font-black text-foreground">{label}</span>
    </button>
  );
}

/**
 * Record, stop, keep. Nothing is uploaded until the student stops, and the
 * microphone track is released the moment recording ends rather than when the
 * component unmounts — an in-use indicator that outlives the recording reads
 * as Kondo still listening.
 */
function VoiceRecorder({
  onRecorded,
  onCancel,
  busy,
}: {
  onRecorded: (file: File) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(
      () => setSeconds((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [recording]);

  // A recording still running when the student navigates away must not keep
  // the microphone open.
  useEffect(
    () => () => {
      recorder.current?.stream.getTracks().forEach((track) => track.stop());
      recorder.current = null;
    },
    [],
  );

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const media = new MediaRecorder(stream, { mimeType: AUDIO_MIME });
      const chunks: Blob[] = [];
      media.addEventListener("dataavailable", (event) => {
        if (event.data.size) chunks.push(event.data);
      });
      media.addEventListener("stop", () => {
        stream.getTracks().forEach((track) => track.stop());
        recorder.current = null;
        setRecording(false);
        if (!chunks.length) return;
        onRecorded(
          new File(
            [new Blob(chunks, { type: AUDIO_MIME })],
            "voice-note.webm",
            {
              type: AUDIO_MIME,
            },
          ),
        );
      });
      recorder.current = media;
      setSeconds(0);
      setRecording(true);
      media.start();
    } catch {
      setError("Kondo could not use the microphone.");
    }
  }

  return (
    <div className="animate-sheet-in mt-3 rounded-2xl border border-border bg-card p-4 motion-reduce:animate-none">
      <div className="flex items-center gap-3">
        <button
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-full text-white transition disabled:opacity-60",
            recording ? "bg-destructive" : "bg-kondo-green",
          )}
          disabled={busy}
          onClick={() => (recording ? recorder.current?.stop() : void start())}
          type="button"
        >
          {busy ? (
            <Loader2
              aria-hidden="true"
              className="h-5 w-5 animate-spin motion-reduce:animate-none"
            />
          ) : recording ? (
            <Square aria-hidden="true" className="h-4 w-4 fill-current" />
          ) : (
            <Mic aria-hidden="true" className="h-5 w-5" />
          )}
          <span className="sr-only">
            {recording ? "Stop recording" : "Start recording"}
          </span>
        </button>
        <p className="min-w-0 flex-1 text-sm font-bold text-foreground">
          {busy
            ? "Saving voice note…"
            : recording
              ? `Recording ${formatSeconds(seconds)}`
              : "Record a voice note"}
          {!recording && !busy ? (
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              Stays private to you.
            </span>
          ) : null}
        </p>
        {!recording && !busy ? (
          <button
            className="shrink-0 text-xs font-black text-muted-foreground transition hover:text-kondo-green"
            onClick={onCancel}
            type="button"
          >
            Back
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-xs font-bold text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

function formatSeconds(total: number) {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
