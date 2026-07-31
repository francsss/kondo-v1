"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  MapPinned,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { uploadMediaFile } from "@/lib/client-media";
import {
  createConfiguredMapProvider,
  isMapProviderConfigured,
} from "@/lib/maps";

type ReferenceData = {
  countries: Array<{ id: string; name: string; code: string }>;
  cities: Array<{ id: string; name: string; countryId: string }>;
  universities: Array<{ id: string; name: string; cityId: string }>;
  organizations: Array<{ id: string; name: string }>;
};

const inputClass =
  "h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-ring/20";
const labelClass = "grid gap-2 text-sm font-bold";
const steps = ["Home basics", "Location & costs", "Details & photos"] as const;

export function HousingCreateForm({
  initialOrganizationId,
  references,
}: {
  initialOrganizationId?: string;
  references: ReferenceData;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [step, setStep] = useState(0);
  const [countryId, setCountryId] = useState(references.countries[0]?.id ?? "");
  const [cityId, setCityId] = useState("");
  const [publicLocationLabel, setPublicLocationLabel] = useState("");
  const [locationPoint, setLocationPoint] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const validInitialOrganizationId = references.organizations.some(
    ({ id }) => id === initialOrganizationId,
  )
    ? initialOrganizationId
    : undefined;
  const [publisherType, setPublisherType] = useState<
    "PERSONAL" | "ORGANIZATION"
  >(validInitialOrganizationId ? "ORGANIZATION" : "PERSONAL");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cities = useMemo(
    () => references.cities.filter((city) => city.countryId === countryId),
    [countryId, references.cities],
  );
  const universities = useMemo(
    () => references.universities.filter((item) => item.cityId === cityId),
    [cityId, references.universities],
  );

  function goToNextStep() {
    const section = formRef.current?.querySelector<HTMLElement>(
      `[data-housing-step="${step}"]`,
    );
    const fields = section?.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input, select, textarea");
    const invalid = fields
      ? Array.from(fields).find((field) => !field.checkValidity())
      : null;
    if (invalid) {
      invalid.reportValidity();
      invalid.focus();
      return;
    }
    setStep((current) => Math.min(steps.length - 1, current + 1));
  }

  async function resolveApproximateLocation() {
    if (!cityId || !publicLocationLabel.trim() || locating) return;
    if (!isMapProviderConfigured()) {
      setLocationStatus(
        "Map placement is unavailable right now. You can still create the draft.",
      );
      return;
    }
    setLocating(true);
    setLocationStatus(null);
    try {
      const cityName =
        references.cities.find((city) => city.id === cityId)?.name ?? "";
      const countryName =
        references.countries.find((country) => country.id === countryId)
          ?.name ?? "China";
      const point = await createConfiguredMapProvider().geocode([
        `${publicLocationLabel}, ${cityName}, ${countryName}`,
        `${publicLocationLabel}, ${cityName}, China`,
      ]);
      if (!point) {
        setLocationStatus(
          "We could not place this area. Check the public location label or continue without a map pin.",
        );
        return;
      }
      setLocationPoint(point);
      setLocationStatus(
        "Approximate map area ready. The exact coordinate will never be shown publicly.",
      );
    } catch {
      setLocationStatus(
        "Map placement is temporarily unavailable. You can continue without it.",
      );
    } finally {
      setLocating(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < steps.length - 1) {
      goToNextStep();
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(null);
    setProgress(2);
    const form = new FormData(event.currentTarget);
    const payload = {
      publisherType,
      organizationId:
        publisherType === "ORGANIZATION"
          ? String(form.get("organizationId") || "")
          : null,
      type: String(form.get("type")),
      title: String(form.get("title")),
      shortDescription: String(form.get("shortDescription")),
      description: String(form.get("description")),
      houseRules: String(form.get("houseRules") || "") || null,
      neighborhoodContext:
        String(form.get("neighborhoodContext") || "") || null,
      transportContext: String(form.get("transportContext") || "") || null,
      universityContext: null,
      countryId,
      cityId,
      district: String(form.get("district") || "") || null,
      universityId: String(form.get("universityId") || "") || null,
      publicLocationLabel: String(form.get("publicLocationLabel")),
      privateAddress: String(form.get("privateAddress") || "") || null,
      exactLatitude: locationPoint?.lat ?? null,
      exactLongitude: locationPoint?.lng ?? null,
      locationPrivacy: String(form.get("locationPrivacy")),
      monthlyRentMinor: Math.round(Number(form.get("monthlyRent")) * 100),
      currency: String(form.get("currency")),
      depositMinor: form.get("deposit")
        ? Math.round(Number(form.get("deposit")) * 100)
        : null,
      utilitiesMinor: form.get("utilities")
        ? Math.round(Number(form.get("utilities")) * 100)
        : null,
      agencyFeeMinor: null,
      serviceFeeMinor: null,
      otherCostsDescription:
        String(form.get("otherCostsDescription") || "") || null,
      paymentPeriod: "MONTHLY",
      negotiable: form.get("negotiable") === "on",
      bedrooms: form.get("bedrooms") ? Number(form.get("bedrooms")) : null,
      bathrooms: form.get("bathrooms") ? Number(form.get("bathrooms")) : null,
      sizeSquareMeters: form.get("sizeSquareMeters")
        ? Number(form.get("sizeSquareMeters"))
        : null,
      furnishing: String(form.get("furnishing")),
      floor: String(form.get("floor") || "") || null,
      occupancy: null,
      availablePlaces: Number(form.get("availablePlaces") || 1),
      availableFrom: String(form.get("availableFrom")),
      leaseEnd: null,
      minimumStayMonths: form.get("minimumStayMonths")
        ? Number(form.get("minimumStayMonths"))
        : null,
      maximumStayMonths: null,
      smokingPolicy: "NOT_SPECIFIED",
      petPolicy: "NOT_SPECIFIED",
      genderPreference: null,
      accessibilityDetails: null,
      contactPreference: "KONDO_MESSAGE",
      publicContactEnabled: false,
      amenities: form.getAll("amenities"),
      accuracyConfirmed: form.get("accuracyConfirmed") === "on",
    };
    try {
      const response = await fetch("/api/housing/listings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const created = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(created?.error ?? "Could not create the listing.");
      setProgress(10);
      for (const [index, file] of files.entries()) {
        const mediaId = await uploadMediaFile(file, {
          purpose: "HOUSING_LISTING_IMAGE",
          altText: `${payload.title} photo ${index + 1}`,
          onProgress: (fileProgress) =>
            setProgress(
              Math.round(
                10 + ((index + fileProgress / 100) / files.length) * 85,
              ),
            ),
        });
        const attach = await fetch(
          `/api/housing/listings/${created.id}/media`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mediaId,
              kind: index === 0 ? "COVER" : "GALLERY",
              altText: `${payload.title} photo ${index + 1}`,
              isCover: index === 0,
            }),
          },
        );
        if (!attach.ok) {
          const detail = await attach.json().catch(() => null);
          throw new Error(detail?.error ?? "Could not attach a Housing image.");
        }
      }
      setProgress(100);
      router.push(`/housing/manage/${created.id}`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not create the listing.",
      );
      setBusy(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={submit} ref={formRef}>
      <nav aria-label="Housing listing progress">
        <ol className="grid grid-cols-3 gap-2 rounded-3xl border border-border bg-card p-2">
          {steps.map((label, index) => {
            const active = index === step;
            const completed = index < step;
            return (
              <li key={label}>
                <button
                  aria-current={active ? "step" : undefined}
                  className={`flex min-h-14 w-full items-center gap-2 rounded-2xl px-3 text-left text-xs font-black transition sm:text-sm ${
                    active
                      ? "bg-foreground text-background shadow-sm"
                      : completed
                        ? "text-kondo-green hover:bg-kondo-green/8"
                        : "cursor-default text-muted-foreground"
                  }`}
                  disabled={index > step}
                  onClick={() => index < step && setStep(index)}
                  type="button"
                >
                  <span
                    aria-hidden
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] ${
                      active
                        ? "bg-background/15"
                        : completed
                          ? "bg-kondo-green/12"
                          : "bg-muted"
                    }`}
                  >
                    {completed ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section
        className="rounded-3xl border border-border bg-card p-5 sm:p-7"
        data-housing-step="0"
        hidden={step !== 0}
      >
        <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
          1 · Publisher and home
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            Publisher
            <select
              className={inputClass}
              onChange={(event) =>
                setPublisherType(
                  event.target.value as "PERSONAL" | "ORGANIZATION",
                )
              }
              value={publisherType}
            >
              <option value="PERSONAL">My personal account</option>
              {references.organizations.length ? (
                <option value="ORGANIZATION">An organization</option>
              ) : null}
            </select>
          </label>
          {publisherType === "ORGANIZATION" ? (
            <label className={labelClass}>
              Organization
              <select
                className={inputClass}
                defaultValue={validInitialOrganizationId}
                name="organizationId"
                required
              >
                {references.organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className={labelClass}>
            Listing type
            <select className={inputClass} name="type" required>
              <option value="PRIVATE_ROOM">Private room</option>
              <option value="SHARED_ROOM">Shared room</option>
              <option value="ROOMMATE_REPLACEMENT">Roommate replacement</option>
              <option value="SUBLET">Sublet</option>
              {publisherType === "ORGANIZATION" ? (
                <>
                  <option value="ENTIRE_APARTMENT">Entire apartment</option>
                  <option value="STUDENT_RESIDENCE">Student residence</option>
                  <option value="UNIVERSITY_DORMITORY">
                    University dormitory
                  </option>
                  <option value="STUDIO">Studio</option>
                </>
              ) : null}
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Title
            <input
              className={inputClass}
              maxLength={160}
              minLength={5}
              name="title"
              placeholder="Bright private room near Zhejiang University"
              required
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Short summary
            <input
              className={inputClass}
              maxLength={320}
              minLength={10}
              name="shortDescription"
              placeholder="Furnished room in a quiet shared apartment, 10 minutes from campus."
              required
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Full description
            <textarea
              className="min-h-40 w-full rounded-2xl border border-border bg-background p-4 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              maxLength={8000}
              minLength={20}
              name="description"
              required
            />
          </label>
        </div>
      </section>

      <section
        className="rounded-3xl border border-border bg-card p-5 sm:p-7"
        data-housing-step="1"
        hidden={step !== 1}
      >
        <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
          2 · Location and price
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            Country
            <select
              className={inputClass}
              onChange={(event) => {
                setCountryId(event.target.value);
                setCityId("");
                setLocationPoint(null);
                setLocationStatus(null);
              }}
              value={countryId}
            >
              {references.countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            City
            <select
              className={inputClass}
              onChange={(event) => {
                setCityId(event.target.value);
                setLocationPoint(null);
                setLocationStatus(null);
              }}
              required
              value={cityId}
            >
              <option value="">Choose a city</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            University (optional)
            <select className={inputClass} name="universityId">
              <option value="">No specific university</option>
              {universities.map((university) => (
                <option key={university.id} value={university.id}>
                  {university.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            District
            <input className={inputClass} maxLength={160} name="district" />
          </label>
          <label className={labelClass}>
            Public location label
            <input
              className={inputClass}
              maxLength={240}
              name="publicLocationLabel"
              onChange={(event) => {
                setPublicLocationLabel(event.target.value);
                setLocationPoint(null);
                setLocationStatus(null);
              }}
              placeholder="Near Yuquan Campus"
              required
              value={publicLocationLabel}
            />
          </label>
          <div className="self-end">
            <Button
              disabled={!cityId || !publicLocationLabel.trim() || locating}
              onClick={resolveApproximateLocation}
              type="button"
              variant="secondary"
            >
              {locating ? (
                <Loader2
                  aria-hidden
                  className="h-4 w-4 animate-spin motion-reduce:animate-none"
                />
              ) : (
                <MapPinned aria-hidden className="h-4 w-4" />
              )}
              {locationPoint ? "Update map area" : "Place approximate pin"}
            </Button>
          </div>
          {locationStatus ? (
            <p
              aria-live="polite"
              className="text-xs leading-5 text-muted-foreground sm:col-span-2"
            >
              {locationStatus}
            </p>
          ) : null}
          <label className={labelClass}>
            Location privacy
            <select className={inputClass} name="locationPrivacy">
              <option value="APPROXIMATE_AREA">Approximate area</option>
              <option value="NEAR_UNIVERSITY">Near university</option>
              <option value="DISTRICT_ONLY">District only</option>
              <option value="EXACT_AFTER_CONTACT">Exact after contact</option>
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Private exact address (never shown publicly by default)
            <input
              className={inputClass}
              maxLength={500}
              name="privateAddress"
            />
          </label>
          <label className={labelClass}>
            Monthly rent
            <input
              className={inputClass}
              min="0"
              name="monthlyRent"
              required
              type="number"
            />
          </label>
          <label className={labelClass}>
            Currency
            <select className={inputClass} defaultValue="CNY" name="currency">
              <option value="CNY">CNY</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className={labelClass}>
            Deposit
            <input
              className={inputClass}
              min="0"
              name="deposit"
              type="number"
            />
          </label>
          <label className={labelClass}>
            Estimated monthly utilities
            <input
              className={inputClass}
              min="0"
              name="utilities"
              type="number"
            />
          </label>
          <label className="flex items-center gap-3 text-sm font-bold sm:col-span-2">
            <input className="h-4 w-4" name="negotiable" type="checkbox" />
            Rent is negotiable
          </label>
        </div>
      </section>

      <section
        className="rounded-3xl border border-border bg-card p-5 sm:p-7"
        data-housing-step="2"
        hidden={step !== 2}
      >
        <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
          3 · Details and photos
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            Available from
            <input
              className={inputClass}
              name="availableFrom"
              required
              type="date"
            />
          </label>
          <label className={labelClass}>
            Minimum stay (months)
            <input
              className={inputClass}
              min="1"
              name="minimumStayMonths"
              type="number"
            />
          </label>
          <label className={labelClass}>
            Bedrooms
            <input
              className={inputClass}
              min="0"
              name="bedrooms"
              type="number"
            />
          </label>
          <label className={labelClass}>
            Bathrooms
            <input
              className={inputClass}
              min="0"
              name="bathrooms"
              step="0.5"
              type="number"
            />
          </label>
          <label className={labelClass}>
            Size (m²)
            <input
              className={inputClass}
              min="1"
              name="sizeSquareMeters"
              type="number"
            />
          </label>
          <label className={labelClass}>
            Available places
            <input
              className={inputClass}
              defaultValue="1"
              min="1"
              name="availablePlaces"
              type="number"
            />
          </label>
          <label className={labelClass}>
            Furnishing
            <select className={inputClass} name="furnishing">
              <option value="FURNISHED">Furnished</option>
              <option value="PARTLY_FURNISHED">Partly furnished</option>
              <option value="UNFURNISHED">Unfurnished</option>
              <option value="UNKNOWN">Not specified</option>
            </select>
          </label>
          <label className={labelClass}>
            Floor
            <input className={inputClass} maxLength={40} name="floor" />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            House rules (optional)
            <textarea
              className="min-h-28 rounded-2xl border border-border bg-background p-4 text-sm"
              maxLength={2000}
              name="houseRules"
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Neighborhood and transport context
            <textarea
              className="min-h-28 rounded-2xl border border-border bg-background p-4 text-sm"
              maxLength={1200}
              name="neighborhoodContext"
            />
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-bold">Amenities</legend>
            <div className="mt-3 flex flex-wrap gap-3">
              {[
                "WIFI",
                "AIR_CONDITIONING",
                "HEATING",
                "WASHING_MACHINE",
                "KITCHEN",
                "ELEVATOR",
                "SECURITY",
                "PUBLIC_TRANSPORT",
              ].map((amenity) => (
                <label
                  className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-bold"
                  key={amenity}
                >
                  <input name="amenities" type="checkbox" value={amenity} />
                  {amenity.toLowerCase().replaceAll("_", " ")}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="sm:col-span-2">
            <span className="flex items-center gap-2 text-sm font-bold">
              <ImagePlus className="h-4 w-4" /> Photos (1–8)
            </span>
            <input
              accept="image/jpeg,image/png,image/webp"
              className="mt-3 block w-full rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-sm"
              multiple
              onChange={(event) =>
                setFiles(Array.from(event.target.files ?? []).slice(0, 8))
              }
              required
              type="file"
            />
          </label>
          <label className="flex items-start gap-3 rounded-2xl bg-muted/40 p-4 text-sm leading-6 sm:col-span-2">
            <input
              className="mt-1 h-4 w-4"
              name="accuracyConfirmed"
              required
              type="checkbox"
            />
            <span>
              <strong className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-kondo-green" />
                Accuracy confirmation
              </strong>
              I confirm that the price, availability, location context and
              photos are current and that I am authorized to publish this home.
            </span>
          </label>
        </div>
      </section>

      {busy ? (
        <div aria-live="polite" className="rounded-2xl bg-muted p-4">
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-kondo-green transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-sm font-bold">
            Preparing listing… {progress}%
          </p>
        </div>
      ) : null}
      {error ? (
        <p aria-live="assertive" className="text-sm font-bold text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <Button
          disabled={busy || step === 0}
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          type="button"
          variant="ghost"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
          Back
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={goToNextStep} type="button">
            Continue
            <ChevronRight aria-hidden className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            disabled={busy || !cityId || files.length === 0}
            size="lg"
            type="submit"
          >
            {busy ? "Creating…" : "Create Housing draft"}
          </Button>
        )}
      </div>
    </form>
  );
}
