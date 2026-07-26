"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Check,
  GraduationCap,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  UserRoundSearch,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

type Country = { id: string; name: string };
type University = { id: string; name: string; countryId: string };
type Scholarship = {
  id: string;
  title: string;
  provider: string;
  countryId: string | null;
  country: Country | null;
  universityIds: string[];
  city: string | null;
  studyLevels: string[];
  fields: string[];
  eligibleNationalities: string[];
  fundingType: "FULL" | "PARTIAL";
  status: "OPEN" | "OPENING_SOON" | "CLOSED";
  opensAt: string | null;
  closesAt: string | null;
  deadline: string | null;
  applicationUrl: string;
  description: string;
  eligibilityCriteria: string[];
  requiredDocuments: string[];
  coverage: string[];
  applicationSteps: string[];
  isFeatured: boolean;
  lastVerifiedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
type Agent = {
  id: string;
  name: string;
  company: string | null;
  logoUrl: string | null;
  countryId: string | null;
  country: Country | null;
  languages: string[];
  specialties: string[];
  services: string[];
  feeDetails: string | null;
  whatsapp: string | null;
  wechat: string | null;
  email: string | null;
  website: string | null;
  availability: "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
  averageRating: number | null;
  biography: string;
  verified: boolean;
  verifiedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const input =
  "h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-kondo-green focus:ring-2 focus:ring-kondo-green/15";
const textarea = `${input} h-auto min-h-28 py-3`;
const studyLevels = [
  "LANGUAGE",
  "BACHELORS",
  "MASTERS",
  "DOCTORATE",
  "EXCHANGE",
  "OTHER",
];

function splitList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.error ?? "The change could not be saved.");
  return payload;
}

export function ScholarshipAdminManager({
  scholarships,
  agents,
  countries,
  universities,
  canManage,
}: {
  scholarships: Scholarship[];
  agents: Agent[];
  countries: Country[];
  universities: University[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"scholarships" | "agents">("scholarships");
  const [editingScholarship, setEditingScholarship] =
    useState<Scholarship | null>(null);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function mutate(task: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
      setMessage(success);
      setEditingScholarship(null);
      setEditingAgent(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  function submitScholarship(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      title: form.get("title"),
      provider: form.get("provider"),
      countryId: form.get("countryId") || null,
      universityIds: form.getAll("universityIds"),
      city: form.get("city") || null,
      studyLevels: form.getAll("studyLevels"),
      fields: splitList(form.get("fields")),
      eligibleNationalities: splitList(form.get("eligibleNationalities")),
      fundingType: form.get("fundingType"),
      status: form.get("status"),
      opensAt: form.get("opensAt") || null,
      closesAt: form.get("closesAt") || null,
      applicationUrl: form.get("applicationUrl"),
      description: form.get("description"),
      eligibilityCriteria: splitList(form.get("eligibilityCriteria")),
      requiredDocuments: splitList(form.get("requiredDocuments")),
      coverage: splitList(form.get("coverage")),
      applicationSteps: splitList(form.get("applicationSteps")),
      isFeatured: form.get("isFeatured") === "on",
      isActive: form.get("isActive") === "on",
      markVerified: form.get("markVerified") === "on",
    };
    void mutate(
      () =>
        send(
          editingScholarship
            ? `/api/admin/scholarships/${editingScholarship.id}`
            : "/api/admin/scholarships",
          editingScholarship ? "PATCH" : "POST",
          body,
        ),
      editingScholarship ? "Scholarship updated." : "Scholarship published.",
    );
  }

  function submitAgent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rating = String(form.get("averageRating") ?? "").trim();
    const body = {
      name: form.get("name"),
      company: form.get("company") || null,
      logoUrl: form.get("logoUrl") || null,
      countryId: form.get("countryId") || null,
      languages: splitList(form.get("languages")),
      specialties: splitList(form.get("specialties")),
      services: splitList(form.get("services")),
      feeDetails: form.get("feeDetails") || null,
      whatsapp: form.get("whatsapp") || null,
      wechat: form.get("wechat") || null,
      email: form.get("email") || null,
      website: form.get("website") || null,
      availability: form.get("availability"),
      averageRating: rating ? Number(rating) : null,
      biography: form.get("biography"),
      verified: form.get("verified") === "on",
      isActive: form.get("isActive") === "on",
    };
    void mutate(
      () =>
        send(
          editingAgent
            ? `/api/admin/scholarship-agents/${editingAgent.id}`
            : "/api/admin/scholarship-agents",
          editingAgent ? "PATCH" : "POST",
          body,
        ),
      editingAgent ? "Agent profile updated." : "Agent profile published.",
    );
  }

  return (
    <div className="mt-7 space-y-6">
      <div className="flex gap-2 overflow-x-auto">
        <Button
          onClick={() => setTab("scholarships")}
          variant={tab === "scholarships" ? "primary" : "secondary"}
        >
          <GraduationCap className="h-4 w-4" />
          Scholarships ({scholarships.length})
        </Button>
        <Button
          onClick={() => setTab("agents")}
          variant={tab === "agents" ? "primary" : "secondary"}
        >
          <UserRoundSearch className="h-4 w-4" />
          Agents ({agents.length})
        </Button>
      </div>
      {error ? (
        <p
          className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 dark:bg-red-400/10 dark:text-red-300"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
          <Check className="h-4 w-4" />
          {message}
        </p>
      ) : null}

      {tab === "scholarships" ? (
        <>
          {canManage ? (
            <ScholarshipForm
              busy={busy}
              countries={countries}
              editing={editingScholarship}
              key={editingScholarship?.id ?? "new-scholarship"}
              onCancel={() => setEditingScholarship(null)}
              onSubmit={submitScholarship}
              universities={universities}
            />
          ) : null}
          <div className="grid gap-4 xl:grid-cols-2">
            {scholarships.map((scholarship) => (
              <Card
                className={!scholarship.isActive ? "opacity-60" : ""}
                key={scholarship.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-black uppercase">
                        {scholarship.status.replaceAll("_", " ")}
                      </span>
                      {scholarship.isFeatured ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase text-amber-800">
                          Featured
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-3 text-lg font-black">
                      {scholarship.title}
                    </h2>
                    <p className="text-sm font-bold text-kondo-green">
                      {scholarship.provider}
                    </p>
                  </div>
                  {scholarship.lastVerifiedAt ? (
                    <BadgeCheck
                      aria-label="Recently verified"
                      className="h-5 w-5 text-kondo-green"
                    />
                  ) : null}
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                  {scholarship.description}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {scholarship.country?.name ?? "Any destination"} ·{" "}
                  {scholarship.closesAt ?? "No closing date"} ·{" "}
                  {scholarship.isActive ? "Published" : "Archived"}
                </p>
                {canManage ? (
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => {
                        setEditingScholarship(scholarship);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      size="sm"
                      variant="secondary"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    {scholarship.isActive ? (
                      <Button
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Archive “${scholarship.title}”? Students will no longer see it.`,
                            )
                          ) {
                            void mutate(
                              () =>
                                send(
                                  `/api/admin/scholarships/${scholarship.id}`,
                                  "DELETE",
                                ),
                              "Scholarship archived.",
                            );
                          }
                        }}
                        size="sm"
                        variant="danger"
                      >
                        <Trash2 className="h-4 w-4" />
                        Archive
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          {canManage ? (
            <AgentForm
              busy={busy}
              countries={countries}
              editing={editingAgent}
              key={editingAgent?.id ?? "new-agent"}
              onCancel={() => setEditingAgent(null)}
              onSubmit={submitAgent}
            />
          ) : null}
          <div className="grid gap-4 xl:grid-cols-2">
            {agents.map((agent) => (
              <Card
                className={!agent.isActive ? "opacity-60" : ""}
                key={agent.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black">{agent.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {agent.company ?? "Independent adviser"} ·{" "}
                      {agent.country?.name ?? "Remote"}
                    </p>
                  </div>
                  {agent.verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                  {agent.biography || "No biography yet."}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {agent.availability.replaceAll("_", " ")} ·{" "}
                  {agent.isActive ? "Published" : "Archived"}
                </p>
                {canManage ? (
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => {
                        setEditingAgent(agent);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      size="sm"
                      variant="secondary"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    {agent.isActive ? (
                      <Button
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(`Archive ${agent.name}'s profile?`)
                          ) {
                            void mutate(
                              () =>
                                send(
                                  `/api/admin/scholarship-agents/${agent.id}`,
                                  "DELETE",
                                ),
                              "Agent profile archived.",
                            );
                          }
                        }}
                        size="sm"
                        variant="danger"
                      >
                        <Trash2 className="h-4 w-4" />
                        Archive
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "md:col-span-2" : ""}>
      <span className="mb-2 block text-sm font-black">{label}</span>
      {children}
    </label>
  );
}

function ScholarshipForm({
  editing,
  countries,
  universities,
  busy,
  onCancel,
  onSubmit,
}: {
  editing: Scholarship | null;
  countries: Country[];
  universities: University[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
            Scholarship CMS
          </p>
          <h2 className="mt-1 text-xl font-black">
            {editing ? "Edit opportunity" : "Publish an opportunity"}
          </h2>
        </div>
        {editing ? (
          <Button onClick={onCancel} size="sm" variant="ghost">
            Cancel
          </Button>
        ) : null}
      </div>
      <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <Field label="Title">
          <input
            className={input}
            defaultValue={editing?.title}
            name="title"
            required
          />
        </Field>
        <Field label="Provider">
          <input
            className={input}
            defaultValue={editing?.provider}
            name="provider"
            required
          />
        </Field>
        <FormSearchableSelect
          clearLabel="Derived from university / global"
          defaultValue={editing?.countryId ?? ""}
          label="Destination country"
          name="countryId"
          options={countries}
        />
        <Field label="City">
          <input
            className={input}
            defaultValue={editing?.city ?? ""}
            name="city"
          />
        </Field>
        <div className="md:col-span-2">
          <UniversityPicker
            initialIds={editing?.universityIds ?? []}
            universities={universities}
          />
        </div>
        <Field label="Study levels" wide>
          <div className="flex flex-wrap gap-3 rounded-2xl border border-border p-3">
            {studyLevels.map((level) => (
              <label className="flex items-center gap-2 text-xs" key={level}>
                <input
                  defaultChecked={editing?.studyLevels.includes(level)}
                  name="studyLevels"
                  type="checkbox"
                  value={level}
                />
                {level[0]}
                {level.slice(1).toLowerCase()}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Funding">
          <select
            className={input}
            defaultValue={editing?.fundingType ?? "FULL"}
            name="fundingType"
          >
            <option value="FULL">Full funding</option>
            <option value="PARTIAL">Partial funding</option>
          </select>
        </Field>
        <Field label="Publication status">
          <select
            className={input}
            defaultValue={editing?.status ?? "OPEN"}
            name="status"
          >
            <option value="OPEN">Open</option>
            <option value="OPENING_SOON">Opening soon</option>
            <option value="CLOSED">Closed</option>
          </select>
        </Field>
        <Field label="Opening date">
          <input
            className={input}
            defaultValue={editing?.opensAt ?? ""}
            name="opensAt"
            type="date"
          />
        </Field>
        <Field label="Closing date">
          <input
            className={input}
            defaultValue={editing?.closesAt ?? editing?.deadline ?? ""}
            name="closesAt"
            type="date"
          />
        </Field>
        <Field label="Official application link" wide>
          <input
            className={input}
            defaultValue={editing?.applicationUrl}
            name="applicationUrl"
            required
            type="url"
          />
        </Field>
        <Field label="Description" wide>
          <textarea
            className={textarea}
            defaultValue={editing?.description}
            name="description"
            required
          />
        </Field>
        <ListField
          defaultValue={editing?.fields}
          label="Study fields"
          name="fields"
        />
        <ListField
          defaultValue={editing?.eligibleNationalities}
          label="Eligible nationalities"
          name="eligibleNationalities"
        />
        <ListField
          defaultValue={editing?.eligibilityCriteria}
          label="Eligibility criteria"
          name="eligibilityCriteria"
        />
        <ListField
          defaultValue={editing?.requiredDocuments}
          label="Required documents"
          name="requiredDocuments"
        />
        <ListField
          defaultValue={editing?.coverage}
          label="What the scholarship covers"
          name="coverage"
        />
        <ListField
          defaultValue={editing?.applicationSteps}
          label="Application steps"
          name="applicationSteps"
        />
        <div className="flex flex-wrap gap-5 md:col-span-2">
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              defaultChecked={editing?.isFeatured}
              name="isFeatured"
              type="checkbox"
            />
            Featured opportunity
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              defaultChecked={editing?.isActive ?? true}
              name="isActive"
              type="checkbox"
            />
            Visible to students
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input name="markVerified" type="checkbox" />
            Mark information verified now
          </label>
        </div>
        <div className="md:col-span-2">
          <Button disabled={busy} type="submit">
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {editing ? "Save scholarship" : "Publish scholarship"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ListField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string[];
}) {
  return (
    <Field label={`${label} (one per line)`}>
      <textarea
        className={textarea}
        defaultValue={defaultValue?.join("\n")}
        name={name}
      />
    </Field>
  );
}

function UniversityPicker({
  universities,
  initialIds,
}: {
  universities: University[];
  initialIds: string[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => new Set(initialIds));
  const normalized = query.trim().toLowerCase();
  const visible = universities
    .filter(
      (university) =>
        selected.has(university.id) ||
        !normalized ||
        university.name.toLowerCase().includes(normalized),
    )
    .sort(
      (left, right) =>
        Number(selected.has(right.id)) - Number(selected.has(left.id)),
    )
    .slice(0, 50);
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-black">Universities</legend>
      <input
        aria-label="Search universities"
        className={input}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by university name"
        value={query}
      />
      <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-2xl border border-border p-2">
        {visible.map((university) => (
          <label
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-muted"
            key={university.id}
          >
            <input
              checked={selected.has(university.id)}
              name="universityIds"
              onChange={(event) => {
                setSelected((current) => {
                  const next = new Set(current);
                  if (event.target.checked) next.add(university.id);
                  else next.delete(university.id);
                  return next;
                });
              }}
              type="checkbox"
              value={university.id}
            />
            {university.name}
          </label>
        ))}
        {!visible.length ? (
          <p className="p-3 text-sm text-muted-foreground">
            No university matches this search.
          </p>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {selected.size
          ? `${selected.size} universit${selected.size === 1 ? "y" : "ies"} selected.`
          : "No university restriction selected."}
      </p>
    </fieldset>
  );
}

function AgentForm({
  editing,
  countries,
  busy,
  onCancel,
  onSubmit,
}: {
  editing: Agent | null;
  countries: Country[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
            Trusted adviser directory
          </p>
          <h2 className="mt-1 text-xl font-black">
            {editing ? "Edit agent" : "Add an agent"}
          </h2>
        </div>
        {editing ? (
          <Button onClick={onCancel} size="sm" variant="ghost">
            Cancel
          </Button>
        ) : null}
      </div>
      <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <Field label="Name">
          <input
            className={input}
            defaultValue={editing?.name}
            name="name"
            required
          />
        </Field>
        <Field label="Company">
          <input
            className={input}
            defaultValue={editing?.company ?? ""}
            name="company"
          />
        </Field>
        <Field label="Photo or logo URL">
          <input
            className={input}
            defaultValue={editing?.logoUrl ?? ""}
            name="logoUrl"
            type="url"
          />
        </Field>
        <FormSearchableSelect
          clearLabel="Remote / not specified"
          defaultValue={editing?.countryId ?? ""}
          label="Country"
          name="countryId"
          options={countries}
        />
        <ListField
          defaultValue={editing?.languages}
          label="Languages"
          name="languages"
        />
        <ListField
          defaultValue={editing?.specialties}
          label="Specialties"
          name="specialties"
        />
        <ListField
          defaultValue={editing?.services}
          label="Services"
          name="services"
        />
        <Field label="Fees">
          <textarea
            className={textarea}
            defaultValue={editing?.feeDetails ?? ""}
            name="feeDetails"
          />
        </Field>
        <Field label="WhatsApp">
          <input
            className={input}
            defaultValue={editing?.whatsapp ?? ""}
            name="whatsapp"
          />
        </Field>
        <Field label="WeChat">
          <input
            className={input}
            defaultValue={editing?.wechat ?? ""}
            name="wechat"
          />
        </Field>
        <Field label="Email">
          <input
            className={input}
            defaultValue={editing?.email ?? ""}
            name="email"
            type="email"
          />
        </Field>
        <Field label="Website">
          <input
            className={input}
            defaultValue={editing?.website ?? ""}
            name="website"
            type="url"
          />
        </Field>
        <Field label="Availability">
          <select
            className={input}
            defaultValue={editing?.availability ?? "AVAILABLE"}
            name="availability"
          >
            <option value="AVAILABLE">Available</option>
            <option value="LIMITED">Limited availability</option>
            <option value="UNAVAILABLE">Unavailable</option>
          </select>
        </Field>
        <Field label="Average rating (optional)">
          <input
            className={input}
            defaultValue={editing?.averageRating ?? ""}
            max="5"
            min="0"
            name="averageRating"
            step="0.1"
            type="number"
          />
        </Field>
        <Field label="Biography" wide>
          <textarea
            className={textarea}
            defaultValue={editing?.biography}
            name="biography"
          />
        </Field>
        <div className="flex flex-wrap gap-5 md:col-span-2">
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              defaultChecked={editing?.verified}
              name="verified"
              type="checkbox"
            />
            Verified by Kondo
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              defaultChecked={editing?.isActive ?? true}
              name="isActive"
              type="checkbox"
            />
            Visible to students
          </label>
        </div>
        <div className="md:col-span-2">
          <Button disabled={busy} type="submit">
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {editing ? "Save agent" : "Publish agent"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function FormSearchableSelect({
  label,
  name,
  defaultValue,
  clearLabel,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  clearLabel: string;
  options: Country[];
}) {
  const [selected, setSelected] = useState(defaultValue);
  return (
    <div>
      <input name={name} type="hidden" value={selected} />
      <SearchableSelect
        clearLabel={clearLabel}
        label={label}
        onSelect={setSelected}
        options={options}
        placeholder={clearLabel}
        searchPlaceholder={`Search ${label.toLowerCase()}`}
        selected={selected}
      />
    </div>
  );
}
