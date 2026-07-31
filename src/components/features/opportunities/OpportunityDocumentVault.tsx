"use client";

import { useState } from "react";
import { FileText, LoaderCircle, Trash2, Upload } from "lucide-react";
import { uploadMediaFile } from "@/lib/client-media";

type DocumentItem = {
  id: string;
  category: string;
  displayName: string;
  fileName: string;
  sizeBytes: number;
  ready: boolean;
  scanStatus: string;
  sensitive: boolean;
  createdAt: string;
};

const CATEGORIES = [
  ["CV", "CV"],
  ["RESUME", "Resume"],
  ["TRANSCRIPT", "Academic transcript"],
  ["ENROLLMENT_CERTIFICATE", "Enrollment certificate"],
  ["RECOMMENDATION_LETTER", "Recommendation letter"],
  ["MOTIVATION_LETTER", "Motivation letter"],
  ["LANGUAGE_CERTIFICATE", "Language certificate"],
  ["PORTFOLIO", "Portfolio"],
  ["RESEARCH_PROPOSAL", "Research proposal"],
  ["PASSPORT_COPY", "Passport copy"],
  ["OTHER", "Other"],
] as const;

function readError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string") return value;
  }
  return fallback;
}

export function OpportunityDocumentVault({
  initialDocuments,
}: {
  initialDocuments: DocumentItem[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [category, setCategory] = useState("CV");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(file: File) {
    if (busy) return;
    setBusy(true);
    setProgress(0);
    setMessage(null);
    try {
      const media = await uploadMediaFile(file, {
        purpose: "OPPORTUNITY_APPLICATION_DOCUMENT",
        onProgress: setProgress,
      });
      const response = await fetch("/api/opportunities/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId: media,
          category,
          displayName: file.name.replace(/\.[^.]+$/, ""),
        }),
      });
      const payload = (await response.json()) as DocumentItem & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(readError(payload, "The document could not be saved."));
      }
      setDocuments((current) => [payload, ...current]);
      setMessage("Document added securely.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function archive(documentId: string) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/opportunities/documents/${documentId}`, {
      method: "DELETE",
    });
    const payload = (await response.json()) as unknown;
    if (response.ok) {
      setDocuments((current) =>
        current.filter((document) => document.id !== documentId),
      );
      setMessage("Document removed from your vault.");
    } else {
      setMessage(readError(payload, "The document could not be removed."));
    }
    setBusy(false);
  }

  return (
    <div className="mt-7">
      <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:p-6">
        <h2 className="text-lg font-black">Add a document</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF, PNG or JPEG, up to 10 MB. Files remain private until you attach
          them to an application.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="min-h-11 rounded-2xl border border-black/10 bg-background px-4 text-sm font-semibold dark:border-white/10"
          >
            {CATEGORIES.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-kondo-green px-5 text-sm font-bold text-white">
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Choose file
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              disabled={busy}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        {progress !== null ? (
          <div className="mt-4" aria-live="polite">
            <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                className="h-full bg-kondo-green transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Uploading… {Math.round(progress)}%
            </p>
          </div>
        ) : null}
      </section>

      {message ? (
        <p role="status" className="mt-4 text-sm font-semibold">
          {message}
        </p>
      ) : null}

      <ul className="mt-6 space-y-3">
        {documents.map((document) => (
          <li
            key={document.id}
            className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-kondo-green/10 text-kondo-green">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">
                {document.displayName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {document.fileName} ·{" "}
                {(document.sizeBytes / 1024 / 1024).toFixed(1)} MB
                {document.ready ? " · Ready" : " · Processing"}
                {document.sensitive ? " · Sensitive" : ""}
              </p>
            </div>
            <a
              href={`/api/opportunities/documents/${document.id}/download`}
              className="hidden text-xs font-bold underline sm:inline"
            >
              View
            </a>
            <button
              type="button"
              onClick={() => void archive(document.id)}
              disabled={busy}
              aria-label={`Remove ${document.displayName}`}
              className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 dark:hover:bg-rose-400/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      {documents.length === 0 ? (
        <p className="mt-8 rounded-3xl border border-dashed border-black/10 p-8 text-center text-sm text-muted-foreground dark:border-white/15">
          Your private document vault is empty.
        </p>
      ) : null}
    </div>
  );
}
