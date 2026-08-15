"use client";

import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FocusedFormShell } from "@/components/ui/FocusedFormShell";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  Field,
  FormSection,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/Form";
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

/*
 * Two steps, not four.
 *
 * The old flow split Basics / Pricing / Contact / Media across four screens,
 * which meant four Continues and a step holding a single select. Grouped by
 * what the person is actually deciding, it is: what is this, and what does it
 * cost and how do people reach you.
 */
const STEPS = ["What it is", "Price & publication"];

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // An object URL so the chosen image is previewed without a round trip.
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  // null while idle; 0-100 while an image is actually being sent.
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
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

  useEffect(
    () => () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    },
    [coverPreview],
  );

  function update<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setState((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
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
        setUploadProgress(0);
        const mediaId = await uploadMediaFile(cover, {
          onProgress: setUploadProgress,
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
      setUploadProgress(null);
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
    setCoverPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
    setError("");
    if (!coverAlt) setCoverAlt(state.title);
  }

  const published = initial?.status === "PUBLISHED";
  const pendingReview = initial?.status === "PENDING_REVIEW";
  const needsAmount =
    state.priceType === "FIXED" || state.priceType === "STARTING_AT";

  /*
   * Validation only speaks when the person has had their turn. Nothing is red
   * on arrival; a step is checked when they try to leave it, and the first
   * offending field is focused so they are not hunting for it.
   */
  function validateStep(index: number) {
    const next: Record<string, string> = {};
    if (index === 0) {
      if (!state.title.trim()) next.title = `Enter a ${kind} name.`;
      if (!state.shortDescription.trim())
        next.shortDescription = "Add a short description.";
    }
    if (index === 1) {
      if (needsAmount && !(Number(state.price) > 0))
        next.price = "Price must be greater than 0.";
      if (state.contactMethod === "EXTERNAL_URL" && !state.externalUrl.trim())
        next.externalUrl = "Add the link people should open.";
    }
    setFieldErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      const node = document.querySelector<HTMLElement>(
        `[data-field="${first}"]`,
      );
      node?.scrollIntoView({ block: "center", behavior: "smooth" });
      node?.focus({ preventScroll: true });
    }
    return !first;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((value) => Math.min(STEPS.length - 1, value + 1));
  }

  async function submit() {
    if (!validateStep(0)) {
      setStep(0);
      return;
    }
    if (!validateStep(1)) return;
    await save(true);
  }

  return (
    <FocusedFormShell
      actions={
        <>
          {/*
           * Three controls have to fit a 360px phone. Cancel/Back is the
           * quiet one and shrinks to its label; the primary action keeps its
           * full size and never wraps off the edge.
           */}
          <Button
            className="shrink-0 px-3"
            disabled={pending}
            onClick={() =>
              step === 0
                ? router.push(`/organizations/${organization.slug}/catalog`)
                : setStep((value) => value - 1)
            }
            type="button"
            variant="ghost"
          >
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          <Button
            className="ml-auto shrink-0 px-3"
            disabled={pending}
            onClick={() => void save(false)}
            type="button"
            variant="secondary"
          >
            Save draft
          </Button>
          {step < STEPS.length - 1 ? (
            <Button className="shrink-0" onClick={goNext} type="button">
              Continue
            </Button>
          ) : (
            <Button
              className="shrink-0"
              disabled={pending}
              onClick={() => void submit()}
              type="button"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              ) : null}
              Submit
            </Button>
          )}
        </>
      }
      backHref={`/organizations/${organization.slug}/catalog`}
      context={organization.name}
      step={`Step ${step + 1} of ${STEPS.length}`}
      title={initial ? `Edit ${kind}` : `New ${kind}`}
    >
      <p aria-live="polite" className="sr-only">
        {status}
      </p>

      {step === 0 ? (
        <FormSection>
          <TextField
            autoFocus
            data-field="title"
            error={fieldErrors.title}
            label="Name"
            maxLength={180}
            onChange={(event) => update("title", event.target.value)}
            placeholder={
              kind === "product" ? "Jollof spice mix" : "Visa photo session"
            }
            value={state.title}
          />
          <TextAreaField
            data-field="shortDescription"
            error={fieldErrors.shortDescription}
            hint="One or two lines. This is what people see on the card."
            label="Short description"
            maxLength={400}
            onChange={(event) => update("shortDescription", event.target.value)}
            rows={3}
            value={state.shortDescription}
          />
          <TextAreaField
            hint={`Tell students what this ${kind} includes.`}
            label="Full description"
            maxLength={10000}
            onChange={(event) => update("description", event.target.value)}
            rows={7}
            value={state.description}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Category"
              maxLength={100}
              onChange={(event) => update("category", event.target.value)}
              value={state.category}
            />
            {/*
             * Up to 500 cities arrive here. A native select makes finding one
             * a scroll; this is type-to-filter, which is the only reason to
             * reach for a search UI — short lists keep the plain select.
             */}
            <SearchableSelect
              clearLabel="Available beyond one city"
              label="City"
              onSelect={(id) => update("cityId", id)}
              options={cities.map((city) => ({ id: city.id, name: city.name }))}
              placeholder="Available beyond one city"
              searchPlaceholder="Search cities"
              selected={state.cityId}
            />
          </div>

          <Field hint="JPG, PNG or WebP · maximum 8 MB." label="Cover image">
            {/*
             * The preview replaces the drop zone in place and is fixed height,
             * so choosing an image never pushes the rest of the form down.
             */}
            <label className="flex min-h-32 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-border bg-muted/25 text-sm font-bold transition hover:border-kondo-green">
              {coverPreview ? (
                <span className="relative block h-32 w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=""
                    className="h-32 w-full object-cover"
                    src={coverPreview}
                  />
                  {/*
                   * Progress is drawn over the preview rather than beside it,
                   * so nothing is added to the layout while a file uploads.
                   */}
                  {uploadProgress !== null ? (
                    <span className="absolute inset-x-0 bottom-0 block bg-overlay/60 px-3 py-2">
                      <span className="block text-[11px] font-black text-white">
                        Uploading {Math.round(uploadProgress)}%
                      </span>
                      <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-white/30">
                        <span
                          className="block h-full rounded-full bg-white transition-[width] duration-200 motion-reduce:transition-none"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </span>
                    </span>
                  ) : null}
                </span>
              ) : (
                <>
                  <ImagePlus aria-hidden="true" className="h-5 w-5" />
                  {initial?.coverMediaId ? "Replace image" : "Choose an image"}
                </>
              )}
              <input
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={chooseCover}
                type="file"
              />
            </label>
          </Field>
          {cover ? (
            <TextField
              hint="Describes the image for people using a screen reader."
              label="Image description"
              maxLength={240}
              onChange={(event) => setCoverAlt(event.target.value)}
              value={coverAlt}
            />
          ) : null}
        </FormSection>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-8">
          <FormSection title="Price">
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField
                label="Pricing"
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
              </SelectField>
              {/* Only asked when the pricing choice actually needs a number. */}
              {needsAmount ? (
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <TextField
                    data-field="price"
                    error={fieldErrors.price}
                    inputMode="decimal"
                    label="Amount"
                    min="0"
                    onChange={(event) => update("price", event.target.value)}
                    step="0.01"
                    type="number"
                    value={state.price}
                  />
                  <TextField
                    className="w-24 uppercase"
                    label="Currency"
                    maxLength={3}
                    onChange={(event) =>
                      update("currency", event.target.value.toUpperCase())
                    }
                    value={state.currency}
                  />
                </div>
              ) : null}
            </div>
            <TextField
              label="Availability"
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
            {kind === "service" ? (
              <TextField
                label="Delivery mode"
                maxLength={160}
                onChange={(event) => update("deliveryMode", event.target.value)}
                placeholder="Online, in person, or hybrid"
                value={state.deliveryMode}
              />
            ) : null}
            <TextField
              label="Public location"
              maxLength={200}
              onChange={(event) => update("locationLabel", event.target.value)}
              placeholder="Citywide, campus, or district"
              value={state.locationLabel}
            />
          </FormSection>

          <FormSection title="How people reach you">
            <SelectField
              label="Contact method"
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
            </SelectField>
            {state.contactMethod === "EXTERNAL_URL" ? (
              <TextField
                data-field="externalUrl"
                error={fieldErrors.externalUrl}
                hint="http and https only. Kondo may block an unsafe link."
                inputMode="url"
                label="Official external URL"
                onChange={(event) => update("externalUrl", event.target.value)}
                placeholder="https://"
                value={state.externalUrl}
              />
            ) : null}
          </FormSection>

          <FormSection title="Review">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="truncate text-base font-black text-foreground">
                {state.title || `Untitled ${kind}`}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {state.shortDescription ||
                  "Your short description will appear here."}
              </p>
              <p className="mt-3 text-sm font-black text-foreground">
                {state.priceType === "FREE"
                  ? "Free"
                  : state.priceType === "CONTACT"
                    ? "Contact for price"
                    : `${state.priceType === "STARTING_AT" ? "From " : ""}${state.currency} ${state.price || "0"}`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {organization.name} · submitted for review before it goes public
              </p>
            </div>
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
          </FormSection>

          {initial && (pendingReview || published) && canPublish ? (
            <div className="flex flex-wrap gap-2">
              {pendingReview ? (
                <Button
                  disabled={pending}
                  onClick={() => void transition("PUBLISH")}
                  type="button"
                >
                  Publish now
                </Button>
              ) : null}
              {published ? (
                <Button
                  disabled={pending}
                  onClick={() => void transition("PAUSE")}
                  type="button"
                  variant="secondary"
                >
                  Pause
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/*
       * A failed save keeps every field exactly as typed and says what the
       * server said, rather than resetting the form or showing a shrug.
       */}
      {error ? (
        <p
          className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm font-bold text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </FocusedFormShell>
  );
}
