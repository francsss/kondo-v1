"use client";

import { ChangeEvent, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileCheck2,
  FilePlus2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { uploadMediaFile } from "@/lib/client-media";

type VerificationDocument = {
  id?: string;
  mediaId: string;
  type: string;
  label: string;
};
type VerificationState = {
  id: string;
  status: string;
  legalNameSnapshot: string;
  registrationNumber: string | null;
  registrationCountryId: string;
  authorityDescription: string;
  officialWebsite: string | null;
  publicContactEmail: string;
  userVisibleResponse: string | null;
  submittedAt: string | null;
  documents: VerificationDocument[];
} | null;

const documentTypes = [
  ["BUSINESS_REGISTRATION", "Business registration"],
  ["UNIVERSITY_AUTHORIZATION", "University authorization"],
  ["ASSOCIATION_REGISTRATION", "Association registration"],
  ["REPRESENTATIVE_AUTHORIZATION", "Representative authorization"],
  ["OFFICIAL_LETTER", "Official letter"],
  ["ADDRESS_PROOF", "Address proof"],
  ["OTHER", "Other supporting document"],
] as const;

export function OrganizationVerificationFlow({
  organization,
  countries,
  initialVerification,
}: {
  organization: {
    id: string;
    publicName: string;
    legalName: string | null;
    countryId: string;
    website: string | null;
    professionalEmail: string | null;
    verificationStatus: string;
  };
  countries: Array<{ id: string; name: string }>;
  initialVerification: VerificationState;
}) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    legalName:
      initialVerification?.legalNameSnapshot ?? organization.legalName ?? "",
    registrationNumber: initialVerification?.registrationNumber ?? "",
    registrationCountryId:
      initialVerification?.registrationCountryId ?? organization.countryId,
    authorityDescription: initialVerification?.authorityDescription ?? "",
    officialWebsite:
      initialVerification?.officialWebsite ?? organization.website ?? "",
    publicContactEmail:
      initialVerification?.publicContactEmail ??
      organization.professionalEmail ??
      "",
    documents: initialVerification?.documents ?? [],
  });
  const locked = Boolean(
    initialVerification &&
    ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "SUSPENDED"].includes(
      initialVerification.status,
    ),
  );

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const mediaId = await uploadMediaFile(file, {
        purpose: "ORGANIZATION_VERIFICATION_DOCUMENT",
      });
      setForm((current) => ({
        ...current,
        documents: [
          ...current.documents,
          {
            mediaId,
            type: "OTHER",
            label: file.name.slice(0, 120),
          },
        ],
      }));
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The private document could not be uploaded.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function save(submit: boolean) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(
        `/api/organizations/${organization.id}/verification`,
        {
          method: submit ? "POST" : "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            ...(submit ? { confirm: true } : {}),
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "The verification request could not be saved.");
        return;
      }
      setSuccess(
        submit
          ? "Verification request submitted for human review."
          : "Verification draft saved.",
      );
      if (submit) window.location.reload();
    } catch {
      setError("Kondo could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  if (locked) {
    return (
      <section className="rounded-4xl border border-border bg-card p-7 text-center shadow-sm sm:p-10">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
          <ShieldCheck className="h-8 w-8" />
        </span>
        <h2 className="mt-5 text-2xl font-black">
          {initialVerification?.status === "APPROVED"
            ? "Organization verified"
            : "Verification is being reviewed"}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          {initialVerification?.userVisibleResponse ||
            "Kondo received the organization information and private documents. No review duration is promised."}
        </p>
        {initialVerification?.submittedAt ? (
          <p className="mt-4 text-xs font-semibold text-muted-foreground">
            Submitted{" "}
            {new Date(initialVerification.submittedAt).toLocaleString()}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-4xl border border-border bg-card p-5 shadow-sm sm:p-8">
      <ol aria-label="Verification steps" className="grid grid-cols-4 gap-2">
        {["Information", "Authority", "Documents", "Review"].map(
          (label, index) => (
            <li className="min-w-0" key={label}>
              <div
                className={`h-1.5 rounded-full ${
                  index <= step ? "bg-kondo-green" : "bg-muted"
                }`}
              />
              <span className="mt-2 hidden truncate text-xs font-bold sm:block">
                {label}
              </span>
            </li>
          ),
        )}
      </ol>

      <div className="mt-8 min-h-80">
        {step === 0 ? (
          <div className="grid gap-5">
            <h2 className="text-2xl font-black">Organization information</h2>
            <TextField
              label="Registered legal name"
              onChange={(legalName) => setForm({ ...form, legalName })}
              value={form.legalName}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Registration number (when applicable)"
                onChange={(registrationNumber) =>
                  setForm({ ...form, registrationNumber })
                }
                value={form.registrationNumber}
              />
              <SearchableSelect
                label="Registration country"
                onSelect={(registrationCountryId) =>
                  setForm({ ...form, registrationCountryId })
                }
                options={countries}
                placeholder="Select country"
                searchPlaceholder="Search countries…"
                selected={form.registrationCountryId}
              />
              <TextField
                label="Official website"
                onChange={(officialWebsite) =>
                  setForm({ ...form, officialWebsite })
                }
                type="url"
                value={form.officialWebsite}
              />
              <TextField
                label="Public professional email"
                onChange={(publicContactEmail) =>
                  setForm({ ...form, publicContactEmail })
                }
                type="email"
                value={form.publicContactEmail}
              />
            </div>
          </div>
        ) : null}
        {step === 1 ? (
          <div>
            <h2 className="text-2xl font-black">Representative authority</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Explain your role and why you may represent this organization.
            </p>
            <textarea
              className="mt-5 min-h-48 w-full rounded-3xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-kondo-green"
              maxLength={1200}
              onChange={(event) =>
                setForm({
                  ...form,
                  authorityDescription: event.target.value,
                })
              }
              value={form.authorityDescription}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {form.authorityDescription.length}/1200
            </p>
          </div>
        ) : null}
        {step === 2 ? (
          <div>
            <h2 className="text-2xl font-black">Supporting documents</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              PDF, JPEG, PNG or WebP. Files remain private and are accessible
              only to authorized organization managers and Kondo reviewers.
            </p>
            <label className="mt-5 flex min-h-24 cursor-pointer items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-background px-5 text-sm font-bold hover:border-kondo-green/60">
              <FilePlus2 className="h-5 w-5 text-kondo-green" />
              {uploading ? "Uploading and validating…" : "Add private document"}
              <input
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={uploading}
                onChange={upload}
                type="file"
              />
            </label>
            <div className="mt-4 grid gap-3">
              {form.documents.map((document, index) => (
                <div
                  className="grid gap-3 rounded-2xl border border-border p-3 sm:grid-cols-[auto_minmax(0,1fr)_220px_auto] sm:items-center"
                  key={document.mediaId}
                >
                  <FileCheck2 className="h-5 w-5 text-kondo-green" />
                  <input
                    aria-label="Document label"
                    className="h-10 min-w-0 rounded-xl border border-border bg-background px-3 text-sm"
                    maxLength={120}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        documents: current.documents.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    value={document.label}
                  />
                  <select
                    aria-label="Document type"
                    className="h-10 rounded-xl border border-border bg-background px-3 text-xs"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        documents: current.documents.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, type: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    value={document.type}
                  >
                    {documentTypes.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <Button
                    aria-label="Remove document"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        documents: current.documents.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      }))
                    }
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {step === 3 ? (
          <div>
            <h2 className="text-2xl font-black">Review and consent</h2>
            <div className="mt-5 grid gap-3 rounded-3xl bg-muted/60 p-5 text-sm">
              <Summary label="Legal name" value={form.legalName} />
              <Summary
                label="Registration country"
                value={
                  countries.find(
                    (country) => country.id === form.registrationCountryId,
                  )?.name ?? "Not selected"
                }
              />
              <Summary
                label="Professional email"
                value={form.publicContactEmail}
              />
              <Summary
                label="Private documents"
                value={String(form.documents.length)}
              />
            </div>
            <p className="mt-5 rounded-2xl border border-border px-4 py-3 text-xs leading-5 text-muted-foreground">
              Verification confirms that Kondo reviewed the organization
              identity. It is not a guarantee of product quality, outcomes,
              legal advice or official Kondo partnership.
            </p>
          </div>
        ) : null}
      </div>

      {initialVerification?.status === "MORE_INFORMATION_REQUIRED" ? (
        <p className="mt-4 rounded-2xl bg-warning/10 px-4 py-3 text-sm font-semibold text-warning-foreground">
          {initialVerification.userVisibleResponse ||
            "Kondo needs more information before continuing the review."}
        </p>
      ) : null}
      {error ? (
        <p
          className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="mt-4 rounded-2xl bg-kondo-mint px-4 py-3 text-sm font-semibold text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
          role="status"
        >
          {success}
        </p>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          disabled={step === 0 || saving}
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          variant="ghost"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex gap-2">
          <Button
            disabled={saving || uploading}
            onClick={() => save(false)}
            variant="secondary"
          >
            {saving ? "Saving…" : "Save draft"}
          </Button>
          {step < 3 ? (
            <Button
              disabled={saving || uploading}
              onClick={() => setStep((current) => Math.min(3, current + 1))}
            >
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              disabled={saving || uploading || !form.documents.length}
              onClick={() => save(true)}
            >
              Submit for review <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "url";
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <input
        className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-kondo-green"
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-bold">{value || "Not provided"}</span>
    </div>
  );
}
