"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  LoaderCircle,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { uploadMediaFile } from "@/lib/client-media";
import type { PublicOpportunityDetail } from "@/lib/opportunities";

type DocumentItem = {
  id: string;
  category: string;
  displayName: string;
  fileName: string;
  sizeBytes: number;
  ready: boolean;
  sensitive: boolean;
};

type Applicant = {
  name: string;
  email: string;
  country: string | null;
  city: string | null;
  university: string | null;
  studyLevel: string | null;
  degree: string | null;
};

const STEPS = [
  "Eligibility",
  "Your details",
  "Questions",
  "Documents",
  "Experience",
  "Review",
  "Submit",
] as const;

const DOCUMENT_LABELS: Record<string, string> = {
  CV: "CV",
  RESUME: "Resume",
  TRANSCRIPT: "Academic transcript",
  ENROLLMENT_CERTIFICATE: "Enrollment certificate",
  RECOMMENDATION_LETTER: "Recommendation letter",
  MOTIVATION_LETTER: "Motivation letter",
  LANGUAGE_CERTIFICATE: "Language certificate",
  PORTFOLIO: "Portfolio",
  RESEARCH_PROPOSAL: "Research proposal",
  PASSPORT_COPY: "Passport copy",
  OTHER: "Other document",
};

function readError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string") return value;
  }
  return fallback;
}

function listFromText(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 30);
}

export function OpportunityApplicationWizard({
  opportunity,
  applicant,
  initialDocuments,
  initialProfessionalProfile,
}: {
  opportunity: PublicOpportunityDetail;
  applicant: Applicant;
  initialDocuments: DocumentItem[];
  initialProfessionalProfile: {
    skills: string[];
    professionalInterests: string[];
    portfolioUrl: string;
    professionalProfileUrl: string;
    workAuthorizationNote: string;
  };
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [informationResponse, setInformationResponse] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [eligibleConfirmed, setEligibleConfirmed] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [profile, setProfile] = useState(initialProfessionalProfile);
  const [busy, setBusy] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef(false);

  const requiredCategories = useMemo(
    () =>
      new Set(
        opportunity.requirements
          .filter((entry) => entry.required)
          .map((entry) => entry.documentType),
      ),
    [opportunity.requirements],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const response = await fetch("/api/opportunities/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opportunityId: opportunity.id }),
        });
        const payload = (await response.json()) as {
          id?: string;
          status?: string;
          answers?: Array<{
            questionId: string;
            answerText: string | null;
          }>;
          documents?: Array<{ id: string; userDocumentId: string }>;
          error?: string;
        };
        if (!response.ok || !payload.id) {
          throw new Error(
            readError(payload, "Unable to start your application."),
          );
        }
        if (
          payload.status !== "DRAFT" &&
          payload.status !== "MORE_INFORMATION_REQUIRED"
        ) {
          router.replace(`/opportunities/applications/${payload.id}`);
          return;
        }
        setInformationResponse(payload.status === "MORE_INFORMATION_REQUIRED");
        setApplicationId(payload.id);
        setAnswers(
          Object.fromEntries(
            (payload.answers ?? []).map((entry) => [
              entry.questionId,
              entry.answerText ?? "",
            ]),
          ),
        );
        setSelectedDocumentIds(
          (payload.documents ?? []).map((entry) => entry.userDocumentId),
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to start your application.",
        );
      } finally {
        setBusy(false);
      }
    })();
  }, [opportunity.id, router]);

  async function saveDraft() {
    if (!applicationId) return false;
    const response = await fetch(
      `/api/opportunities/applications/${applicationId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: opportunity.questions.map((question) => ({
            questionId: question.id,
            answerText: answers[question.id] ?? "",
          })),
          documentIds: selectedDocumentIds,
        }),
      },
    );
    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      setMessage(readError(payload, "Your draft could not be saved."));
      return false;
    }
    return true;
  }

  async function saveProfile() {
    const response = await fetch("/api/opportunities/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skills: profile.skills,
        professionalInterests: profile.professionalInterests,
        portfolioUrl: profile.portfolioUrl || null,
        professionalProfileUrl: profile.professionalProfileUrl || null,
        workAuthorizationNote: profile.workAuthorizationNote || null,
      }),
    });
    if (!response.ok) {
      setMessage(
        readError(
          await response.json(),
          "Your professional profile could not be saved.",
        ),
      );
      return false;
    }
    return true;
  }

  async function next() {
    setMessage(null);
    if (step === 0 && !eligibleConfirmed) {
      setMessage("Confirm that you reviewed the eligibility information.");
      return;
    }
    if (step === 2) {
      const missing = opportunity.questions.find(
        (question) => question.required && !(answers[question.id] ?? "").trim(),
      );
      if (missing) {
        setMessage(`Complete “${missing.label}” before continuing.`);
        return;
      }
    }
    if (step === 3) {
      const selectedCategories = new Set(
        documents
          .filter((document) => selectedDocumentIds.includes(document.id))
          .map((document) => document.category),
      );
      const missing = [...requiredCategories].find(
        (category) => !selectedCategories.has(category),
      );
      if (missing) {
        setMessage(
          `Attach the required ${DOCUMENT_LABELS[missing] ?? missing}.`,
        );
        return;
      }
    }
    setBusy(true);
    const saved = await saveDraft();
    const profileSaved = step === 4 ? await saveProfile() : true;
    setBusy(false);
    if (saved && profileSaved) setStep((current) => Math.min(6, current + 1));
  }

  async function uploadDocument(file: File, category: string) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setUploadProgress(0);
    try {
      const media = await uploadMediaFile(file, {
        purpose: "OPPORTUNITY_APPLICATION_DOCUMENT",
        onProgress: setUploadProgress,
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
        throw new Error(readError(payload, "The document could not be added."));
      }
      setDocuments((current) => [payload, ...current]);
      setSelectedDocumentIds((current) => [
        ...new Set([...current, payload.id]),
      ]);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The upload did not complete.",
      );
    } finally {
      setUploadProgress(null);
      setBusy(false);
    }
  }

  async function submit() {
    if (!applicationId || busy) return;
    if (!consentAccepted) {
      setMessage("Confirm the information you are sharing before submitting.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (!(await saveDraft())) return;
      const response = await fetch(
        `/api/opportunities/applications/${applicationId}/${informationResponse ? "respond" : "submit"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            informationResponse ? {} : { consentAccepted: true },
          ),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          readError(payload, "Your application could not be submitted."),
        );
      }
      router.replace(`/opportunities/applications/${applicationId}`);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Your application could not be submitted.",
      );
    } finally {
      setBusy(false);
    }
  }

  const panel = (() => {
    if (step === 0) {
      return (
        <div>
          <h2 className="text-xl font-black">Review your eligibility</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Eligibility guidance helps you assess fit, but the provider makes
            the final decision.
          </p>
          <ul className="mt-5 space-y-3">
            {opportunity.eligibilityCriteria.map((criterion) => (
              <li key={criterion.id} className="flex gap-3 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-kondo-green" />
                <span>{criterion.label}</span>
              </li>
            ))}
            {opportunity.eligibilityCriteria.length === 0 ? (
              <li className="text-sm text-muted-foreground">
                The provider will review eligibility manually.
              </li>
            ) : null}
          </ul>
          <label className="mt-6 flex cursor-pointer gap-3 rounded-2xl bg-kondo-green/5 p-4 text-sm">
            <input
              type="checkbox"
              checked={eligibleConfirmed}
              onChange={(event) => setEligibleConfirmed(event.target.checked)}
              className="mt-0.5 accent-kondo-green"
            />
            I reviewed the criteria and understand that eligibility is not a
            guarantee of selection.
          </label>
        </div>
      );
    }
    if (step === 1) {
      return (
        <div>
          <h2 className="text-xl font-black">Your details</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            These profile details will be captured when you submit.
          </p>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            {Object.entries({
              Name: applicant.name,
              Email: applicant.email,
              Country: applicant.country,
              City: applicant.city,
              University: applicant.university,
              "Study level": applicant.studyLevel,
              "Field of study": applicant.degree,
            }).map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl bg-black/[0.03] p-4 dark:bg-white/[0.05]"
              >
                <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 text-sm font-semibold">
                  {value || "Not provided"}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      );
    }
    if (step === 2) {
      return (
        <div>
          <h2 className="text-xl font-black">Application questions</h2>
          <div className="mt-5 space-y-5">
            {opportunity.questions.map((question) => {
              const options = Array.isArray(question.options)
                ? question.options.filter(
                    (entry): entry is string => typeof entry === "string",
                  )
                : [];
              return (
                <label key={question.id} className="block text-sm font-bold">
                  {question.label}{" "}
                  {question.required ? (
                    <span className="text-rose-600">*</span>
                  ) : null}
                  {question.description ? (
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      {question.description}
                    </span>
                  ) : null}
                  {question.type === "LONG_TEXT" ? (
                    <textarea
                      value={answers[question.id] ?? ""}
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: event.target.value,
                        }))
                      }
                      rows={5}
                      className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-kondo-green dark:border-white/10"
                    />
                  ) : options.length ? (
                    <select
                      value={answers[question.id] ?? ""}
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-2xl border border-black/10 bg-background px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-kondo-green dark:border-white/10"
                    >
                      <option value="">Choose an option</option>
                      {options.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={
                        question.type === "DATE"
                          ? "date"
                          : question.type === "NUMBER"
                            ? "number"
                            : "text"
                      }
                      value={answers[question.id] ?? ""}
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-kondo-green dark:border-white/10"
                    />
                  )}
                </label>
              );
            })}
            {opportunity.questions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No additional questions are required.
              </p>
            ) : null}
          </div>
        </div>
      );
    }
    if (step === 3) {
      return (
        <div>
          <h2 className="text-xl font-black">Documents</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Select a saved document or upload a PDF, PNG or JPEG up to 10 MB.
          </p>
          <div className="mt-5 space-y-4">
            {opportunity.requirements.map((requirement) => {
              const choices = documents.filter(
                (document) =>
                  document.category === requirement.documentType &&
                  document.ready,
              );
              return (
                <section
                  key={requirement.id}
                  className="rounded-2xl border border-black/10 p-4 dark:border-white/10"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black">
                        {DOCUMENT_LABELS[requirement.documentType] ??
                          requirement.documentType}
                        {requirement.required ? (
                          <span className="ml-1 text-rose-600">*</span>
                        ) : null}
                      </h3>
                      {requirement.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {requirement.description}
                        </p>
                      ) : null}
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-xs font-bold hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5">
                      <Upload className="h-4 w-4" /> Upload
                      <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg"
                        className="sr-only"
                        disabled={busy}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file)
                            void uploadDocument(file, requirement.documentType);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <div className="mt-3 space-y-2">
                    {choices.map((document) => (
                      <label
                        key={document.id}
                        className="flex cursor-pointer items-center gap-3 rounded-xl bg-black/[0.03] px-3 py-2 text-sm dark:bg-white/[0.05]"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDocumentIds.includes(document.id)}
                          onChange={(event) =>
                            setSelectedDocumentIds((current) =>
                              event.target.checked
                                ? [...new Set([...current, document.id])]
                                : current.filter((id) => id !== document.id),
                            )
                          }
                          className="accent-kondo-green"
                        />
                        <FileText className="h-4 w-4 text-kondo-green" />
                        <span className="min-w-0 flex-1 truncate">
                          {document.displayName}
                        </span>
                      </label>
                    ))}
                    {choices.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No saved file in this category.
                      </p>
                    ) : null}
                  </div>
                </section>
              );
            })}
            {opportunity.requirements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This application does not require documents.
              </p>
            ) : null}
          </div>
          {uploadProgress !== null ? (
            <div className="mt-4" aria-live="polite">
              <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className="h-full bg-kondo-green transition-[width]"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Uploading… {Math.round(uploadProgress)}%
              </p>
            </div>
          ) : null}
        </div>
      );
    }
    if (step === 4) {
      return (
        <div>
          <h2 className="text-xl font-black">Professional context</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Saved privately to your Opportunities profile for future
            applications.
          </p>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-bold">
              Skills
              <input
                defaultValue={profile.skills.join(", ")}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    skills: listFromText(event.target.value),
                  }))
                }
                placeholder="Research, Python, communication"
                className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-kondo-green dark:border-white/10"
              />
            </label>
            <label className="block text-sm font-bold">
              Professional interests
              <input
                defaultValue={profile.professionalInterests.join(", ")}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    professionalInterests: listFromText(event.target.value),
                  }))
                }
                placeholder="Sustainability, product design"
                className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-kondo-green dark:border-white/10"
              />
            </label>
            <label className="block text-sm font-bold">
              Portfolio URL{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
              <input
                type="url"
                value={profile.portfolioUrl}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    portfolioUrl: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-kondo-green dark:border-white/10"
              />
            </label>
            <label className="block text-sm font-bold">
              Professional profile URL{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
              <input
                type="url"
                value={profile.professionalProfileUrl}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    professionalProfileUrl: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-kondo-green dark:border-white/10"
              />
            </label>
            <label className="block text-sm font-bold">
              Work authorization note{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
              <textarea
                rows={3}
                value={profile.workAuthorizationNote}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    workAuthorizationNote: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-kondo-green dark:border-white/10"
              />
            </label>
          </div>
        </div>
      );
    }
    if (step === 5) {
      return (
        <div>
          <h2 className="text-xl font-black">Review your application</h2>
          <div className="mt-5 space-y-5 text-sm">
            <section>
              <h3 className="font-black">Applicant</h3>
              <p className="mt-1 text-muted-foreground">
                {applicant.name} · {applicant.email}
              </p>
            </section>
            <section>
              <h3 className="font-black">Answers</h3>
              <ul className="mt-2 space-y-2">
                {opportunity.questions.map((question) => (
                  <li key={question.id}>
                    <span className="font-semibold">{question.label}:</span>{" "}
                    <span className="text-muted-foreground">
                      {answers[question.id] || "Not answered"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="font-black">Documents</h3>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {documents
                  .filter((document) =>
                    selectedDocumentIds.includes(document.id),
                  )
                  .map((document) => (
                    <li key={document.id}>{document.displayName}</li>
                  ))}
                {selectedDocumentIds.length === 0 ? (
                  <li>No documents attached.</li>
                ) : null}
              </ul>
            </section>
          </div>
        </div>
      );
    }
    return (
      <div className="text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-kondo-green" />
        <h2 className="mt-4 text-xl font-black">
          {informationResponse
            ? "Ready to send your update?"
            : "Ready to submit?"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Your application will be shared only with authorized reviewers for{" "}
          {opportunity.publisher.name}. You cannot edit it after submission
          unless more information is requested.
        </p>
        <label className="mx-auto mt-6 flex max-w-lg cursor-pointer gap-3 rounded-2xl bg-kondo-green/5 p-4 text-left text-sm">
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(event) => setConsentAccepted(event.target.checked)}
            className="mt-0.5 accent-kondo-green"
          />
          I confirm that the information is accurate and consent to sharing this
          {informationResponse ? " update" : " application"} with the publisher.
        </label>
      </div>
    );
  })();

  return (
    <div className="mx-auto max-w-[960px] px-4 pb-24 pt-6 sm:px-6 lg:pt-10">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <header className="mt-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
          Application
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
          {opportunity.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {opportunity.publisher.name}
        </p>
      </header>

      <ol
        className="mt-6 grid grid-cols-7 gap-1"
        aria-label="Application progress"
      >
        {STEPS.map((label, index) => (
          <li key={label} aria-current={index === step ? "step" : undefined}>
            <div
              className={`h-1.5 rounded-full transition-colors ${index <= step ? "bg-kondo-green" : "bg-black/10 dark:bg-white/10"}`}
            />
            <span className="mt-2 hidden text-[11px] font-bold text-muted-foreground sm:block">
              {label}
            </span>
          </li>
        ))}
      </ol>

      <main className="mt-6 min-h-[420px] rounded-[28px] border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:p-8">
        {busy && !applicationId ? (
          <div className="grid min-h-[320px] place-items-center">
            <LoaderCircle
              className="h-7 w-7 animate-spin text-kondo-green"
              aria-label="Preparing application"
            />
          </div>
        ) : (
          panel
        )}
      </main>

      {message ? (
        <p
          role="alert"
          className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-400/10 dark:text-rose-300"
        >
          {message}
        </p>
      ) : null}

      <footer className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0 || busy}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 px-5 text-sm font-bold disabled:opacity-40 dark:border-white/10"
        >
          <ArrowLeft className="h-4 w-4" /> Previous
        </button>
        {step < 6 ? (
          <button
            type="button"
            onClick={() => void next()}
            disabled={busy || !applicationId}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-kondo-green px-5 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{" "}
            Save & continue <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !applicationId}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-kondo-green px-6 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}{" "}
            {informationResponse
              ? "Send requested information"
              : "Submit application"}
          </button>
        )}
      </footer>
    </div>
  );
}
