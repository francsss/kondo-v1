"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { uploadMediaFile } from "@/lib/client-media";

type OrganizationProfile = {
  id: string;
  slug: string;
  publicName: string;
  legalName: string | null;
  type: string;
  tagline: string | null;
  shortDescription: string | null;
  extendedDescription: string | null;
  foundingYear: number | null;
  sizeRange: string | null;
  countryId: string;
  cityId: string | null;
  website: string | null;
  professionalEmail: string | null;
  professionalPhone: string | null;
  websiteWechat: string | null;
  publicAddress: string | null;
  serviceAreas: string[];
  supportedLanguages: string[];
  contactAudience: string;
  logoMediaId: string | null;
  coverMediaId: string | null;
};

export function OrganizationProfileForm({
  organization,
  countries,
  cities,
}: {
  organization: OrganizationProfile;
  countries: Array<{ id: string; name: string }>;
  cities: Array<{
    id: string;
    name: string;
    secondary?: string;
    countryId: string;
  }>;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    ...organization,
    legalName: organization.legalName ?? "",
    tagline: organization.tagline ?? "",
    shortDescription: organization.shortDescription ?? "",
    extendedDescription: organization.extendedDescription ?? "",
    foundingYear: organization.foundingYear?.toString() ?? "",
    sizeRange: organization.sizeRange ?? "",
    cityId: organization.cityId ?? "",
    website: organization.website ?? "",
    professionalEmail: organization.professionalEmail ?? "",
    professionalPhone: organization.professionalPhone ?? "",
    websiteWechat: organization.websiteWechat ?? "",
    publicAddress: organization.publicAddress ?? "",
    serviceAreas: organization.serviceAreas.join(", "),
    supportedLanguages: organization.supportedLanguages.join(", "),
    logoMediaId: organization.logoMediaId ?? "",
    coverMediaId: organization.coverMediaId ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const availableCities = useMemo(
    () => cities.filter((city) => city.countryId === form.countryId),
    [cities, form.countryId],
  );

  async function save() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(
        `/api/organizations/${organization.id}/profile`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            foundingYear: form.foundingYear
              ? Number(form.foundingYear)
              : undefined,
            sizeRange: form.sizeRange || undefined,
            cityId: form.cityId || undefined,
            serviceAreas: splitValues(form.serviceAreas),
            supportedLanguages: splitValues(form.supportedLanguages),
            logoMediaId: form.logoMediaId || undefined,
            coverMediaId: form.coverMediaId || undefined,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "The organization profile could not be saved.");
        return;
      }
      setSuccess("Organization profile saved.");
      if (data.organization?.slug !== organization.slug) {
        router.replace(`/organizations/${data.organization.slug}/profile`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Kondo could not reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function upload(
    event: ChangeEvent<HTMLInputElement>,
    kind: "logo" | "cover",
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(kind);
    setError("");
    try {
      const mediaId = await uploadMediaFile(file, {
        purpose: kind === "logo" ? "ORGANIZATION_LOGO" : "ORGANIZATION_COVER",
        altText:
          kind === "logo"
            ? `${form.publicName} logo`
            : `${form.publicName} cover image`,
      });
      setForm((current) => ({
        ...current,
        [kind === "logo" ? "logoMediaId" : "coverMediaId"]: mediaId,
      }));
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The image could not be uploaded.",
      );
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="grid gap-6">
      <ProfileSection
        description="The identity teammates see while managing this workspace."
        title="Public identity"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Public name"
            onChange={(publicName) => setForm({ ...form, publicName })}
            value={form.publicName}
          />
          <TextField
            label="Workspace address"
            onChange={(slug) => setForm({ ...form, slug })}
            prefix="joinkondo.com/organizations/"
            value={form.slug}
          />
          <TextField
            label="Legal name"
            onChange={(legalName) => setForm({ ...form, legalName })}
            value={form.legalName}
          />
          <TextField
            label="Public tagline"
            onChange={(tagline) => setForm({ ...form, tagline })}
            value={form.tagline}
          />
          <label>
            <span className="mb-2 block text-sm font-bold">
              Organization size
            </span>
            <select
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm"
              onChange={(event) =>
                setForm({ ...form, sizeRange: event.target.value })
              }
              value={form.sizeRange}
            >
              <option value="">Not specified</option>
              <option value="SOLO">1 person</option>
              <option value="TWO_TO_TEN">2–10 people</option>
              <option value="ELEVEN_TO_FIFTY">11–50 people</option>
              <option value="FIFTY_ONE_TO_TWO_HUNDRED">51–200 people</option>
              <option value="TWO_HUNDRED_PLUS">More than 200</option>
            </select>
          </label>
          <TextField
            inputMode="numeric"
            label="Founding year"
            onChange={(foundingYear) => setForm({ ...form, foundingYear })}
            value={form.foundingYear}
          />
        </div>
        <TextArea
          label="Short description"
          maxLength={500}
          onChange={(shortDescription) =>
            setForm({ ...form, shortDescription })
          }
          value={form.shortDescription}
        />
        <TextArea
          label="Extended description"
          maxLength={5000}
          onChange={(extendedDescription) =>
            setForm({ ...form, extendedDescription })
          }
          value={form.extendedDescription}
        />
      </ProfileSection>

      <ProfileSection
        description="General location only. Do not enter private or precise coordinates."
        title="Location"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <SearchableSelect
            label="Country"
            onSelect={(countryId) =>
              setForm({ ...form, countryId, cityId: "" })
            }
            options={countries}
            placeholder="Select country"
            searchPlaceholder="Search countries…"
            selected={form.countryId}
          />
          <SearchableSelect
            clearLabel="No city selected"
            label="City"
            onSelect={(cityId) => setForm({ ...form, cityId })}
            options={availableCities}
            placeholder="Select city"
            searchPlaceholder="Search cities…"
            selected={form.cityId}
          />
          <TextField
            label="General public address"
            onChange={(publicAddress) => setForm({ ...form, publicAddress })}
            value={form.publicAddress}
          />
          <TextField
            label="Service areas"
            onChange={(serviceAreas) => setForm({ ...form, serviceAreas })}
            placeholder="Jiaxing, Hangzhou"
            value={form.serviceAreas}
          />
        </div>
      </ProfileSection>

      <ProfileSection
        description="Professional contact information is separate from every member's personal account."
        title="Professional contact"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Email"
            onChange={(professionalEmail) =>
              setForm({ ...form, professionalEmail })
            }
            type="email"
            value={form.professionalEmail}
          />
          <TextField
            label="Phone"
            onChange={(professionalPhone) =>
              setForm({ ...form, professionalPhone })
            }
            value={form.professionalPhone}
          />
          <TextField
            label="Website"
            onChange={(website) => setForm({ ...form, website })}
            type="url"
            value={form.website}
          />
          <TextField
            label="WeChat"
            onChange={(websiteWechat) => setForm({ ...form, websiteWechat })}
            value={form.websiteWechat}
          />
          <TextField
            label="Supported languages"
            onChange={(supportedLanguages) =>
              setForm({ ...form, supportedLanguages })
            }
            placeholder="English, French, Chinese"
            value={form.supportedLanguages}
          />
          <label>
            <span className="mb-2 block text-sm font-bold">
              Contact visibility
            </span>
            <select
              className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm"
              onChange={(event) =>
                setForm({ ...form, contactAudience: event.target.value })
              }
              value={form.contactAudience}
            >
              <option value="PUBLIC">Public later</option>
              <option value="MEMBERS">Kondo members</option>
              <option value="PRIVATE">Workspace only</option>
            </select>
          </label>
        </div>
      </ProfileSection>

      <ProfileSection
        description="Brand media stays inside Kondo's visual system."
        title="Brand identity"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <MediaUpload
            label="Organization logo"
            mediaId={form.logoMediaId}
            onChange={(event) => upload(event, "logo")}
            uploading={uploading === "logo"}
          />
          <MediaUpload
            label="Cover image"
            mediaId={form.coverMediaId}
            onChange={(event) => upload(event, "cover")}
            uploading={uploading === "cover"}
          />
        </div>
      </ProfileSection>

      {error ? (
        <p
          className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="rounded-2xl bg-kondo-mint px-4 py-3 text-sm font-semibold text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
          role="status"
        >
          {success}
        </p>
      ) : null}
      <div className="sticky bottom-4 flex justify-end">
        <Button disabled={saving || Boolean(uploading)} onClick={save}>
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </div>
  );
}

function splitValues(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function ProfileSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-4xl border border-border bg-card p-5 shadow-sm sm:p-7">
      <h2 className="text-xl font-black">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 grid gap-5">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  prefix,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "url";
  prefix?: string;
  inputMode?: "numeric";
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold">{label}</span>
      {prefix ? (
        <span className="mb-1 block text-[11px] text-muted-foreground">
          {prefix}
        </span>
      ) : null}
      <input
        className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-kondo-green focus:ring-4 focus:ring-kondo-green/10"
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <textarea
        className="min-h-28 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-kondo-green focus:ring-4 focus:ring-kondo-green/10"
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
      <span className="mt-1 block text-right text-[11px] text-muted-foreground">
        {value.length}/{maxLength}
      </span>
    </label>
  );
}

function MediaUpload({
  label,
  mediaId,
  onChange,
  uploading,
}: {
  label: string;
  mediaId: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
}) {
  return (
    <label className="rounded-3xl border border-dashed border-border bg-background p-4">
      <span className="text-sm font-bold">{label}</span>
      {mediaId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="mt-3 h-28 w-full rounded-2xl object-cover"
          src={`/api/media/${mediaId}`}
        />
      ) : (
        <span className="mt-3 grid h-28 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <ImagePlus className="h-6 w-6" />
        </span>
      )}
      <span className="mt-3 block text-xs font-bold text-kondo-green">
        {uploading ? "Uploading…" : "Choose image"}
      </span>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={uploading}
        onChange={onChange}
        type="file"
      />
    </label>
  );
}
