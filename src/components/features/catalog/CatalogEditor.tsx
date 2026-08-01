"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { uploadMediaFile } from "@/lib/client-media";

type Kind = "product" | "service";
type EditorState = {
  title: string;
  shortDescription: string;
  description: string;
  category: string;
  cityId: string;
  priceType: "FREE" | "FIXED" | "STARTING_AT" | "CONTACT";
  price: string;
  currency: string;
  availabilityLabel: string;
  locationLabel: string;
  deliveryMode: string;
  contactMethod: "KONDO_MESSAGE" | "PUBLIC_CONTACT" | "EXTERNAL_URL";
  externalUrl: string;
  accuracyConfirmed: boolean;
};

const empty: EditorState = {
  title: "",
  shortDescription: "",
  description: "",
  category: "General",
  cityId: "",
  priceType: "CONTACT",
  price: "",
  currency: "CNY",
  availabilityLabel: "",
  locationLabel: "",
  deliveryMode: "",
  contactMethod: "KONDO_MESSAGE",
  externalUrl: "",
  accuracyConfirmed: false,
};

const STEPS = ["Basics", "Pricing", "Contact", "Media & review"];

export function CatalogEditor({
  kind,
  organization,
  cities,
  initial,
  canPublish,
}: {
  kind: Kind;
  organization: { id: string; slug: string; name: string };
  cities: Array<{ id: string; name: string }>;
  initial?: Partial<EditorState> & {
    id: string;
    status: string;
    version: number;
    coverMediaId?: string | null;
  };
  canPublish: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<EditorState>({ ...empty, ...initial });
  const [step, setStep] = useState(0);
  const [resourceId, setResourceId] = useState(initial?.id ?? "");
  const [version, setVersion] = useState(initial?.version ?? 1);
  const [cover, setCover] = useState<File | null>(null);
  const [coverAlt, setCoverAlt] = useState(initial?.title ?? "");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState(initial ? "Saved" : "Draft not saved");
  const [error, setError] = useState("");
  const initialized = useRef(false);
  const pendingRef = useRef(false);
  const draftKey = `kondo:catalog:${organization.id}:${kind}:${initial?.id ?? "new"}`;
  const endpointName = kind === "product" ? "products" : "services";

  useEffect(() => {
    if (initial || initialized.current) return;
    initialized.current = true;
    let timer: number | undefined;
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        timer = window.setTimeout(() => {
          setState((current) => ({ ...current, ...parsed }));
        }, 0);
      }
    } catch {
      // A corrupt local draft must never block the editor.
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [draftKey, initial]);

  useEffect(() => {
    if (initial) return;
    window.localStorage.setItem(draftKey, JSON.stringify(state));
  }, [draftKey, initial, state]);

  const payload = useMemo(
    () => ({
      title: state.title,
      shortDescription: state.shortDescription,
      description: state.description,
      category: state.category,
      cityId: state.cityId || null,
      priceType: state.priceType,
      priceMinor:
        state.priceType === "FIXED" || state.priceType === "STARTING_AT"
          ? Math.round(Number(state.price || 0) * 100)
          : null,
      currency: state.currency.toUpperCase(),
      availabilityLabel: state.availabilityLabel || null,
      locationLabel: state.locationLabel || null,
      deliveryMode: kind === "service" ? state.deliveryMode || null : null,
      contactMethod: state.contactMethod,
      externalUrl: state.externalUrl || null,
      version,
    }),
    [kind, state, version],
  );
  const draftSignature = JSON.stringify({ ...payload, version: 0 });

  // Existing drafts autosave after a calm pause. New records stay local until
  // the user explicitly creates the first server draft, avoiding duplicate
  // records from refreshes or speculative rendering.
  useEffect(() => {
    if (!initial || pendingRef.current) return;
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    setStatus("Unsaved changes");
    const timeout = window.setTimeout(() => void save(false, true), 900);
    return () => window.clearTimeout(timeout);
    // payload intentionally represents all editable fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftSignature]);

  function update<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  async function save(submit = false, quiet = false) {
    if (pendingRef.current) return;
    if (submit && !state.accuracyConfirmed) {
      setError("Confirm that the information and price are accurate.");
      return;
    }
    pendingRef.current = true;
    if (!quiet) setPending(true);
    setError("");
    setStatus(
      quiet ? "Saving…" : resourceId ? "Saving draft…" : "Creating draft…",
    );
    try {
      const id = resourceId;
      const response = await fetch(
        id
          ? `/api/organizations/${organization.id}/${endpointName}/${id}`
          : `/api/organizations/${organization.id}/${endpointName}`,
        {
          method: id ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const saved = (await response.json().catch(() => null)) as {
        id?: string;
        version?: number;
        error?: string;
      } | null;
      if (!response.ok || !saved?.id) {
        throw new Error(saved?.error ?? `The ${kind} could not be saved.`);
      }
      setResourceId(saved.id);
      if (saved.version) setVersion(saved.version);
      if (cover) {
        setStatus("Uploading image…");
        const mediaId = await uploadMediaFile(cover, {
          purpose:
            kind === "product"
              ? "ORGANIZATION_PRODUCT_IMAGE"
              : "ORGANIZATION_SERVICE_IMAGE",
          altText: coverAlt.trim() || state.title,
        });
        const mediaResponse = await fetch(
          `/api/organizations/${organization.id}/${endpointName}/${saved.id}/media`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mediaId,
              mediaKind: "COVER",
              altText: coverAlt.trim() || state.title,
            }),
          },
        );
        const mediaPayload = await mediaResponse.json().catch(() => null);
        if (!mediaResponse.ok) {
          throw new Error(
            mediaPayload?.error ?? "The image could not be attached.",
          );
        }
        setCover(null);
      }
      if (submit) {
        setStatus("Submitting for review…");
        const transition = await fetch(
          `/api/organizations/${organization.id}/${endpointName}/${saved.id}/transition`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "SUBMIT" }),
          },
        );
        const body = await transition.json().catch(() => null);
        if (!transition.ok)
          throw new Error(body?.error ?? "Submission failed.");
      }
      window.localStorage.removeItem(draftKey);
      setStatus(submit ? "Submitted" : "Saved");
      if (submit || !initial) {
        router.push(`/organizations/${organization.slug}/catalog`);
        router.refresh();
      }
    } catch (caught) {
      setStatus("Not saved");
      setError(
        caught instanceof Error
          ? caught.message
          : `The ${kind} could not be saved.`,
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function transition(action: string) {
    if (!resourceId || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/organizations/${organization.id}/${endpointName}/${resourceId}/transition`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.error ?? "The status could not be changed.");
      router.push(`/organizations/${organization.slug}/catalog`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The status could not be changed.",
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  function chooseCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Images must be 8 MB or smaller.");
      return;
    }
    setCover(file);
    if (!coverAlt) setCoverAlt(state.title);
  }

  const published = initial?.status === "PUBLISHED";
  const pendingReview = initial?.status === "PENDING_REVIEW";

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-7 sm:px-6 lg:pt-10">
      <Link
        className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground"
        href={`/organizations/${organization.slug}/catalog`}
      >
        <ChevronLeft className="h-4 w-4" /> Catalog
      </Link>
      <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
        {organization.name}
      </p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">
            {initial ? `Edit ${kind}` : `Create a ${kind}`}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Guided publishing with real pricing, safe links and a professional
            inquiry context.
          </p>
        </div>
        <span
          aria-live="polite"
          className="text-xs font-bold text-muted-foreground"
        >
          {status}
        </span>
      </div>

      <ol
        aria-label="Creation progress"
        className="mt-7 grid grid-cols-4 gap-2"
      >
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              aria-current={step === index ? "step" : undefined}
              className={`min-h-11 w-full rounded-xl px-2 text-[11px] font-bold transition ${step === index ? "bg-kondo-green text-white" : index < step ? "bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200" : "bg-muted text-muted-foreground"}`}
              onClick={() => setStep(index)}
              type="button"
            >
              {index < step ? <Check className="mx-auto h-4 w-4" /> : label}
            </button>
          </li>
        ))}
      </ol>

      <section className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-7">
        {step === 0 ? (
          <div className="grid gap-5">
            <Field label="Title">
              <input
                autoFocus
                className="input"
                maxLength={180}
                onChange={(event) => update("title", event.target.value)}
                value={state.title}
              />
            </Field>
            <Field
              hint="Shown on compact cards. Keep it factual."
              label="Short description"
            >
              <textarea
                className="input min-h-24 py-3"
                maxLength={400}
                onChange={(event) =>
                  update("shortDescription", event.target.value)
                }
                value={state.shortDescription}
              />
            </Field>
            <Field label="Full description">
              <textarea
                className="input min-h-44 py-3"
                maxLength={10000}
                onChange={(event) => update("description", event.target.value)}
                value={state.description}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Category">
                <input
                  className="input"
                  maxLength={100}
                  onChange={(event) => update("category", event.target.value)}
                  value={state.category}
                />
              </Field>
              <Field label="City">
                <select
                  className="input"
                  onChange={(event) => update("cityId", event.target.value)}
                  value={state.cityId}
                >
                  <option value="">Available beyond one city</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        ) : null}
        {step === 1 ? (
          <div className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Pricing">
                <select
                  className="input"
                  onChange={(event) =>
                    update(
                      "priceType",
                      event.target.value as EditorState["priceType"],
                    )
                  }
                  value={state.priceType}
                >
                  <option value="CONTACT">Contact for price</option>
                  <option value="FREE">Free</option>
                  <option value="FIXED">Fixed price</option>
                  <option value="STARTING_AT">Starting at</option>
                </select>
              </Field>
              {state.priceType === "FIXED" ||
              state.priceType === "STARTING_AT" ? (
                <Field label="Real amount">
                  <div className="flex gap-2">
                    <input
                      className="input"
                      min="0"
                      onChange={(event) => update("price", event.target.value)}
                      step="0.01"
                      type="number"
                      value={state.price}
                    />
                    <input
                      aria-label="Currency"
                      className="input w-24 uppercase"
                      maxLength={3}
                      onChange={(event) =>
                        update("currency", event.target.value.toUpperCase())
                      }
                      value={state.currency}
                    />
                  </div>
                </Field>
              ) : null}
            </div>
            <Field label="Availability">
              <input
                className="input"
                maxLength={180}
                onChange={(event) =>
                  update("availabilityLabel", event.target.value)
                }
                placeholder={
                  kind === "product"
                    ? "Available to order"
                    : "Weekdays by appointment"
                }
                value={state.availabilityLabel}
              />
            </Field>
            {kind === "service" ? (
              <Field label="Delivery mode">
                <input
                  className="input"
                  maxLength={160}
                  onChange={(event) =>
                    update("deliveryMode", event.target.value)
                  }
                  placeholder="Online, in person, or hybrid"
                  value={state.deliveryMode}
                />
              </Field>
            ) : null}
            <Field label="Public location">
              <input
                className="input"
                maxLength={200}
                onChange={(event) =>
                  update("locationLabel", event.target.value)
                }
                placeholder="Citywide, campus, or district"
                value={state.locationLabel}
              />
            </Field>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="grid gap-5">
            <Field label="Contact method">
              <select
                className="input"
                onChange={(event) =>
                  update(
                    "contactMethod",
                    event.target.value as EditorState["contactMethod"],
                  )
                }
                value={state.contactMethod}
              >
                <option value="KONDO_MESSAGE">Kondo Messages</option>
                <option value="PUBLIC_CONTACT">
                  Organization public contact
                </option>
                <option value="EXTERNAL_URL">Official external page</option>
              </select>
            </Field>
            {state.contactMethod === "EXTERNAL_URL" ? (
              <Field
                hint="Only http and https links are accepted. Kondo may block an unsafe link."
                label="Official external URL"
              >
                <input
                  className="input"
                  inputMode="url"
                  onChange={(event) =>
                    update("externalUrl", event.target.value)
                  }
                  placeholder="https://"
                  value={state.externalUrl}
                />
              </Field>
            ) : null}
            <div className="rounded-2xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
              Kondo facilitates discovery and professional inquiries. Checkout,
              delivery, ratings and payment claims are not part of this catalog.
            </div>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="grid gap-5">
            <Field hint="JPG, PNG or WebP · maximum 8 MB." label="Cover image">
              <label className="flex min-h-28 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/25 text-sm font-bold hover:border-kondo-green">
                <ImagePlus className="h-5 w-5" />
                {cover
                  ? cover.name
                  : initial?.coverMediaId
                    ? "Replace current image"
                    : "Choose an image"}
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={chooseCover}
                  type="file"
                />
              </label>
            </Field>
            <Field label="Image description">
              <input
                className="input"
                maxLength={240}
                onChange={(event) => setCoverAlt(event.target.value)}
                value={coverAlt}
              />
            </Field>
            <label className="flex items-start gap-3 rounded-2xl border border-border p-4 text-sm font-semibold">
              <input
                checked={state.accuracyConfirmed}
                className="mt-1 h-4 w-4 accent-kondo-green"
                onChange={(event) =>
                  update("accuracyConfirmed", event.target.checked)
                }
                type="checkbox"
              />
              <span>
                I confirm the description, price, availability and external
                claims are accurate and authorized by this organization.
              </span>
            </label>
            <div className="rounded-3xl border border-border bg-muted/30 p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-kondo-green">
                Preview
              </p>
              <h2 className="mt-2 line-clamp-2 text-xl font-black">
                {state.title || `Untitled ${kind}`}
              </h2>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                {state.shortDescription ||
                  "Your short description will appear here."}
              </p>
              <p className="mt-4 text-sm font-black">
                {state.priceType === "FREE"
                  ? "Free"
                  : state.priceType === "CONTACT"
                    ? "Contact for price"
                    : `${state.priceType === "STARTING_AT" ? "From " : ""}${state.currency} ${state.price || "0"}`}
              </p>
            </div>
          </div>
        ) : null}

        {error ? (
          <p
            className="mt-5 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-400/10 dark:text-red-200"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <Button
            disabled={step === 0 || pending}
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            type="button"
            variant="ghost"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex flex-wrap gap-2">
            {initial && pendingReview && canPublish ? (
              <Button
                disabled={pending}
                onClick={() => void transition("PUBLISH")}
                type="button"
              >
                Publish
              </Button>
            ) : null}
            {initial && published && canPublish ? (
              <Button
                disabled={pending}
                onClick={() => void transition("PAUSE")}
                type="button"
                variant="secondary"
              >
                Pause
              </Button>
            ) : null}
            <Button
              disabled={pending}
              onClick={() => void save(false)}
              type="button"
              variant="secondary"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{" "}
              Save draft
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() =>
                  setStep((value) => Math.min(STEPS.length - 1, value + 1))
                }
                type="button"
              >
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                disabled={pending}
                onClick={() => void save(true)}
                type="button"
              >
                Submit for review
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black">{label}</span>
      {hint ? (
        <span className="ml-2 text-xs text-muted-foreground">{hint}</span>
      ) : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}
