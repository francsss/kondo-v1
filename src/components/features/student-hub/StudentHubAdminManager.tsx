"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Building2,
  Check,
  Clock3,
  FileSearch,
  LoaderCircle,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { uploadMediaFile } from "@/lib/client-media";
import {
  calculateUniversityPeriodEnd,
  deriveUniversityPeriodDuration,
  formatUniversityMinutes,
  universityTimeToMinutes,
  validateUniversityPeriodDrafts,
} from "@/lib/university-periods";

type SavedPeriod = {
  id?: string;
  periodNumber: number;
  label: string;
  startTime: string;
  endTime: string;
  displayOrder: number;
  part: "MORNING" | "AFTERNOON" | "EVENING" | null;
  isBreak: boolean;
  isActive: boolean;
};
type EditorPeriod = {
  key: string;
  periodNumber: number;
  startTime: string;
  durationMinutes: number;
  confidence?: number;
  uncertainFields: Array<"periodNumber" | "startTime" | "endTime">;
};
type Campus = {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
type Configuration = {
  id: string;
  campusId: string | null;
  name: string;
  timezone: string;
  primaryLanguage: string;
  isActive: boolean;
  isDefault: boolean;
  version: number;
  campus: { name: string } | null;
  periods: Array<SavedPeriod & { createdAt: string; updatedAt: string }>;
  createdAt: string;
  updatedAt: string;
};
type University = {
  id: string;
  name: string;
  shortName: string | null;
  campuses: Campus[];
  periodConfigurations: Configuration[];
};
type ExtractedPeriod = {
  periodNumber: number | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  confidence: number;
  uncertainFields: EditorPeriod["uncertainFields"];
};
type ExtractionResult = {
  periods: ExtractedPeriod[];
  warnings: string[];
  diagnostics: {
    method: string;
    pageCount: number;
    characterCount: number;
    confidence: number | null;
    model: string;
  };
};

const input =
  "h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-kondo-green";
const uncertainInput =
  "border-amber-400 bg-amber-50/70 dark:border-amber-500/70 dark:bg-amber-400/10";
const initialPeriods: EditorPeriod[] = [
  {
    key: "initial-1",
    periodNumber: 1,
    startTime: "08:00",
    durationMinutes: 45,
    uncertainFields: [],
  },
  {
    key: "initial-2",
    periodNumber: 2,
    startTime: "08:55",
    durationMinutes: 45,
    uncertainFields: [],
  },
];

async function send<T>(url: string, body: unknown, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? "The change could not be saved.");
  }
  return data;
}

function editorPeriods(periods?: SavedPeriod[]) {
  if (!periods?.length) {
    return initialPeriods.map((period) => ({ ...period }));
  }
  const academicPeriods = periods
    .filter((period) => !period.isBreak)
    .map((period, index) => ({
      key: period.id ?? `saved-${index}-${period.periodNumber}`,
      periodNumber: period.periodNumber,
      startTime: period.startTime,
      durationMinutes:
        deriveUniversityPeriodDuration(period.startTime, period.endTime) ?? 0,
      uncertainFields: [],
    }));
  return academicPeriods.length
    ? academicPeriods
    : initialPeriods.map((period) => ({ ...period }));
}

function normalizedPeriods(periods: EditorPeriod[]) {
  return periods.map((period, index) => {
    const endTime = calculateUniversityPeriodEnd(
      period.startTime,
      period.durationMinutes,
    );
    if (!endTime) {
      throw new Error(
        `Period ${period.periodNumber || index + 1} needs a valid start time and duration.`,
      );
    }
    const hour = Number(period.startTime.slice(0, 2));
    return {
      periodNumber: period.periodNumber,
      label: `Period ${period.periodNumber}`,
      startTime: period.startTime,
      endTime,
      displayOrder: index + 1,
      part:
        hour < 12 ? "MORNING" : hour < 18 ? "AFTERNOON" : ("EVENING" as const),
      isBreak: false,
      isActive: true,
    };
  });
}

function activeConfiguration(
  university: University | undefined,
  campusId = "",
) {
  return university?.periodConfigurations.find(
    (configuration) =>
      configuration.isActive && (configuration.campusId ?? "") === campusId,
  );
}

function nextPeriodStart(periods: EditorPeriod[]) {
  const last = periods.at(-1);
  if (!last) return "08:00";
  const end = calculateUniversityPeriodEnd(
    last.startTime,
    last.durationMinutes,
  );
  const endMinutes = end ? universityTimeToMinutes(end) : null;
  return endMinutes === null
    ? "08:00"
    : (formatUniversityMinutes(endMinutes + 10) ?? "08:00");
}

function validateOfficialFile(file: File | null) {
  if (!file) return "Choose an official university timetable.";
  if (
    !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
      file.type,
    )
  ) {
    return "Choose a PDF, JPG, PNG or WebP file.";
  }
  if (file.size > 15 * 1024 * 1024) {
    return "The official timetable must be 15 MB or smaller.";
  }
  return null;
}

function MethodCard({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`rounded-3xl border p-5 text-left transition ${
        active
          ? "border-kondo-green bg-emerald-50 shadow-sm dark:bg-emerald-400/10"
          : "border-border bg-background hover:border-kondo-green/50 hover:bg-muted/50"
      }`}
      onClick={onClick}
      type="button"
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
          active
            ? "bg-kondo-green text-white"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {icon}
      </span>
      <span className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-kondo-green">
        {active ? "Selected" : "Choose"}
      </span>
      <span className="mt-1 block text-base font-black">{title}</span>
      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
        {description}
      </span>
    </button>
  );
}

export function StudentHubAdminManager({
  universities,
  canManage,
}: {
  universities: University[];
  canManage: boolean;
}) {
  const router = useRouter();
  const firstConfiguration = activeConfiguration(universities[0]);
  const [universityId, setUniversityId] = useState(universities[0]?.id ?? "");
  const [campusId, setCampusId] = useState("");
  const [editingConfigurationId, setEditingConfigurationId] = useState<
    string | null
  >(firstConfiguration?.id ?? null);
  const [periods, setPeriods] = useState<EditorPeriod[]>(
    editorPeriods(firstConfiguration?.periods),
  );
  const [setupMode, setSetupMode] = useState<"manual" | "import">("manual");
  const [officialFile, setOfficialFile] = useState<File | null>(null);
  const [importStage, setImportStage] = useState<
    "idle" | "uploading" | "analyzing" | "review"
  >("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([]);
  const [diagnostics, setDiagnostics] = useState<
    ExtractionResult["diagnostics"] | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const university = universities.find((item) => item.id === universityId);
  const configurationForScope = useMemo(
    () => activeConfiguration(university, campusId),
    [campusId, university],
  );
  const periodIssues = useMemo(
    () =>
      validateUniversityPeriodDrafts(
        periods.map((period) => ({
          periodNumber: period.periodNumber,
          startTime: period.startTime,
          durationMinutes: period.durationMinutes,
        })),
      ),
    [periods],
  );
  const invalidIndexes = useMemo(
    () => new Set(periodIssues.flatMap((issue) => issue.indexes)),
    [periodIssues],
  );
  const uncertainCount = periods.filter(
    (period) => period.uncertainFields.length > 0,
  ).length;

  function loadPeriodScope(
    selectedUniversity: University | undefined,
    nextCampusId = "",
  ) {
    const existing = activeConfiguration(selectedUniversity, nextCampusId);
    setCampusId(nextCampusId);
    setEditingConfigurationId(existing?.id ?? null);
    setPeriods(editorPeriods(existing?.periods));
    setOfficialFile(null);
    setImportStage("idle");
    setExtractionWarnings([]);
    setDiagnostics(null);
    setError("");
    setMessage("");
  }

  function updatePeriod(
    index: number,
    field: "periodNumber" | "startTime" | "durationMinutes",
    value: number | string,
  ) {
    setPeriods((current) =>
      current.map((period, itemIndex) => {
        if (itemIndex !== index) return period;
        const uncertaintyField =
          field === "durationMinutes" ? "endTime" : field;
        return {
          ...period,
          [field]: value,
          uncertainFields: period.uncertainFields.filter(
            (item) => item !== uncertaintyField,
          ),
        };
      }),
    );
  }

  function movePeriod(index: number, direction: -1 | 1) {
    setPeriods((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination]!, next[index]!];
      return next;
    });
  }

  async function submitCampus(form: HTMLFormElement, body: unknown) {
    if (!university) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await send(
        `/api/admin/student-hub/universities/${university.id}/campuses`,
        body,
      );
      form.reset();
      setMessage("Campus saved.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Campus save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function analyzeOfficialTimetable() {
    if (!university) return;
    const fileError = validateOfficialFile(officialFile);
    if (fileError || !officialFile) {
      setError(fileError ?? "Choose an official university timetable.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    setExtractionWarnings([]);
    setDiagnostics(null);
    try {
      setImportStage("uploading");
      setUploadProgress(0);
      const mediaId = await uploadMediaFile(officialFile, {
        purpose: "SCHEDULE_IMPORT",
        onProgress: setUploadProgress,
      });
      setImportStage("analyzing");
      const response = await send<{ result: ExtractionResult }>(
        "/api/admin/student-hub/period-configurations/extract",
        {
          universityId: university.id,
          campusId: campusId || null,
          mediaId,
        },
      );
      setPeriods(
        response.result.periods.map((period, index) => ({
          key: `ai-${index}-${period.periodNumber ?? "unknown"}`,
          periodNumber: period.periodNumber ?? 0,
          startTime: period.startTime ?? "",
          durationMinutes: period.durationMinutes ?? 0,
          confidence: period.confidence,
          uncertainFields: period.uncertainFields,
        })),
      );
      setExtractionWarnings(response.result.warnings);
      setDiagnostics(response.result.diagnostics);
      setImportStage("review");
      setMessage(
        "Period structure extracted. Review every highlighted field before saving.",
      );
    } catch (cause) {
      setImportStage("idle");
      setError(
        cause instanceof Error
          ? cause.message
          : "The official timetable could not be analyzed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function savePeriods(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!university) return;
    if (periodIssues.length) {
      setError(periodIssues[0]!.message);
      return;
    }
    if (uncertainCount > 0) {
      setError(
        "Review the highlighted AI fields. Edit each highlighted value to confirm it before saving.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const selectedCampus = university.campuses.find(
        (campus) => campus.id === campusId,
      );
      const body = {
        campusId: campusId || null,
        name: `${selectedCampus?.name ?? university.name} periods`,
        timezone: "Asia/Shanghai",
        primaryLanguage: "zh-CN",
        isActive: true,
        isDefault: true,
        periods: normalizedPeriods(periods),
      };
      await send(
        editingConfigurationId
          ? `/api/admin/student-hub/period-configurations/${editingConfigurationId}`
          : `/api/admin/student-hub/universities/${university.id}/period-configurations`,
        body,
        editingConfigurationId ? "PATCH" : "POST",
      );
      setMessage("Official periods saved. Student imports will use them.");
      setExtractionWarnings([]);
      setDiagnostics(null);
      setImportStage("idle");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Period save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-7 space-y-6">
      <Card>
        <SearchableSelect
          label="University"
          onSelect={(value) => {
            const selectedUniversity = universities.find(
              (item) => item.id === value,
            );
            setUniversityId(value);
            loadPeriodScope(selectedUniversity);
          }}
          options={universities.map((item) => ({
            id: item.id,
            name: item.name,
            secondary: item.shortName ?? undefined,
          }))}
          placeholder="Choose university"
          searchPlaceholder="Search universities"
          selected={universityId}
        />
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Configure a period structure once. Every student at this university
          will automatically receive the correct times during timetable import.
        </p>
      </Card>

      {error ? (
        <p
          className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 dark:bg-red-400/10 dark:text-red-300"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300">
          <Check className="h-4 w-4" /> {message}
        </p>
      ) : null}

      {university ? (
        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <Card>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-kondo-green" />
              <div>
                <h2 className="text-lg font-black">Campuses</h2>
                <p className="text-xs text-muted-foreground">
                  Manage the university&apos;s existing study locations.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {university.campuses.map((campus) => (
                <div className="rounded-2xl bg-muted p-3" key={campus.id}>
                  <p className="text-sm font-black">{campus.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {campus.address || "No address"} ·{" "}
                    {campus.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
              ))}
              {!university.campuses.length ? (
                <p className="text-sm text-muted-foreground">
                  No campuses configured.
                </p>
              ) : null}
            </div>
            {canManage ? (
              <form
                className="mt-5 grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  void submitCampus(form, {
                    name: data.get("name"),
                    address: data.get("address") || null,
                    isActive: true,
                  });
                }}
              >
                <input
                  className={input}
                  name="name"
                  placeholder="Campus name"
                  required
                />
                <input
                  className={input}
                  name="address"
                  placeholder="Address (optional)"
                />
                <Button disabled={busy} type="submit">
                  <Plus className="h-4 w-4" /> Add campus
                </Button>
              </form>
            ) : null}
          </Card>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-5 w-5 text-kondo-green" />
                <div>
                  <h2 className="text-lg font-black">Official periods</h2>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                    Choose a setup method, review the period structure, then
                    save it for student timetable imports.
                  </p>
                </div>
              </div>
              <select
                aria-label="Period campus"
                className={`${input} w-full sm:w-60`}
                onChange={(event) =>
                  loadPeriodScope(university, event.target.value)
                }
                value={campusId}
              >
                <option value="">All campuses</option>
                {university.campuses
                  .filter((campus) => campus.isActive)
                  .map((campus) => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
              </select>
            </div>

            {!configurationForScope && !editingConfigurationId ? (
              <p className="mt-5 flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                No official periods exist for this scope yet.
              </p>
            ) : null}

            {canManage ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <MethodCard
                  active={setupMode === "manual"}
                  description="Enter a start time and individual duration for every period."
                  icon={<Pencil className="h-5 w-5" />}
                  onClick={() => setSetupMode("manual")}
                  title="Configure manually"
                />
                <MethodCard
                  active={setupMode === "import"}
                  description="Upload an official timetable and let DeepSeek prepare the period structure."
                  icon={<Sparkles className="h-5 w-5" />}
                  onClick={() => setSetupMode("import")}
                  title="Import university timetable"
                />
              </div>
            ) : null}

            {canManage && setupMode === "import" ? (
              <div className="mt-5 rounded-3xl border border-border bg-muted/35 p-4 sm:p-5">
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    ["1", "Upload official file"],
                    ["2", "DeepSeek extraction"],
                    ["3", "Review and save"],
                  ].map(([number, label], index) => {
                    const activeStep =
                      importStage === "idle"
                        ? 0
                        : importStage === "uploading"
                          ? 0
                          : importStage === "analyzing"
                            ? 1
                            : 2;
                    return (
                      <div
                        className={`rounded-2xl p-3 ${
                          index <= activeStep
                            ? "bg-background shadow-sm"
                            : "text-muted-foreground"
                        }`}
                        key={number}
                      >
                        <span className="text-[10px] font-black text-kondo-green">
                          STEP {number}
                        </span>
                        <p className="mt-1 text-xs font-bold">{label}</p>
                      </div>
                    );
                  })}
                </div>
                <label className="mt-4 block rounded-3xl border-2 border-dashed border-emerald-200 bg-background p-5 text-center dark:border-emerald-400/20">
                  <Upload className="mx-auto h-6 w-6 text-kondo-green" />
                  <span className="mt-2 block text-sm font-black">
                    Official timetable PDF or image
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    PDF, JPG, PNG or WebP · maximum 15 MB
                  </span>
                  <input
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="mt-4 block w-full text-xs"
                    disabled={busy}
                    key={`${universityId}-${campusId}`}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0] ?? null;
                      setOfficialFile(file);
                      setImportStage("idle");
                      setError(validateOfficialFile(file) ?? "");
                    }}
                    type="file"
                  />
                </label>
                {officialFile ? (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-background p-3 text-xs">
                    <span className="min-w-0 truncate font-bold">
                      {officialFile.name}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {(officialFile.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </div>
                ) : null}
                {busy ? (
                  <div className="mt-4 space-y-2" aria-live="polite">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <LoaderCircle className="h-4 w-4 animate-spin text-kondo-green" />
                      {importStage === "uploading"
                        ? `Uploading official timetable… ${uploadProgress}%`
                        : "Extracting official period times with DeepSeek…"}
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-background">
                      <div
                        className="h-full rounded-full bg-kondo-green transition-[width]"
                        style={{
                          width:
                            importStage === "uploading"
                              ? `${uploadProgress}%`
                              : "100%",
                        }}
                      />
                    </div>
                  </div>
                ) : null}
                <Button
                  className="mt-4"
                  disabled={busy || !officialFile}
                  onClick={() => void analyzeOfficialTimetable()}
                  type="button"
                >
                  {busy ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSearch className="h-4 w-4" />
                  )}
                  {importStage === "review"
                    ? "Analyze another file"
                    : "Extract period structure"}
                </Button>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  Only extracted document text is sent to DeepSeek. The
                  temporary upload is removed after analysis, and nothing is
                  saved until you confirm the reviewed periods below.
                </p>
                {diagnostics ? (
                  <p className="mt-3 rounded-2xl bg-background p-3 text-xs text-muted-foreground">
                    {diagnostics.pageCount} page
                    {diagnostics.pageCount === 1 ? "" : "s"} ·{" "}
                    {diagnostics.characterCount} readable characters ·{" "}
                    {diagnostics.method}
                  </p>
                ) : null}
              </div>
            ) : null}

            {extractionWarnings.length ? (
              <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                <p className="font-black">Review required</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {extractionWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <form className="mt-5" onSubmit={savePeriods}>
              <div className="space-y-2">
                <div className="hidden grid-cols-[84px_1fr_110px_110px_88px] gap-2 px-3 text-[10px] font-black uppercase tracking-wide text-muted-foreground md:grid">
                  <span>Period</span>
                  <span>Starts</span>
                  <span>Duration</span>
                  <span>Ends</span>
                  <span>Order</span>
                </div>
                {periods.map((period, index) => {
                  const endTime = calculateUniversityPeriodEnd(
                    period.startTime,
                    period.durationMinutes,
                  );
                  const periodUncertain =
                    period.uncertainFields.includes("periodNumber");
                  const startUncertain =
                    period.uncertainFields.includes("startTime");
                  const durationUncertain =
                    period.uncertainFields.includes("endTime");
                  return (
                    <div
                      className={`grid grid-cols-2 gap-2 rounded-2xl border p-3 md:grid-cols-[84px_1fr_110px_110px_88px] ${
                        invalidIndexes.has(index) ||
                        period.uncertainFields.length
                          ? "border-amber-300 bg-amber-50/45 dark:border-amber-400/30 dark:bg-amber-400/5"
                          : "border-transparent bg-muted/65"
                      }`}
                      key={period.key}
                    >
                      <label>
                        <span className="mb-1 block text-[10px] font-bold text-muted-foreground md:hidden">
                          Period
                        </span>
                        <input
                          aria-label={`Period ${index + 1} number`}
                          className={`${input} ${
                            periodUncertain ? uncertainInput : ""
                          }`}
                          min={1}
                          onChange={(event) =>
                            updatePeriod(
                              index,
                              "periodNumber",
                              Number(event.target.value),
                            )
                          }
                          required
                          type="number"
                          value={period.periodNumber || ""}
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-[10px] font-bold text-muted-foreground md:hidden">
                          Starts
                        </span>
                        <input
                          aria-label={`Period ${index + 1} start time`}
                          className={`${input} ${
                            startUncertain ? uncertainInput : ""
                          }`}
                          onChange={(event) =>
                            updatePeriod(index, "startTime", event.target.value)
                          }
                          required
                          type="time"
                          value={period.startTime}
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-[10px] font-bold text-muted-foreground md:hidden">
                          Duration
                        </span>
                        <span className="relative block">
                          <input
                            aria-label={`Period ${index + 1} duration`}
                            className={`${input} pr-10 ${
                              durationUncertain ? uncertainInput : ""
                            }`}
                            max={240}
                            min={1}
                            onChange={(event) =>
                              updatePeriod(
                                index,
                                "durationMinutes",
                                Number(event.target.value),
                              )
                            }
                            required
                            type="number"
                            value={period.durationMinutes || ""}
                          />
                          <span className="pointer-events-none absolute right-3 top-3 text-[10px] font-bold text-muted-foreground">
                            min
                          </span>
                        </span>
                      </label>
                      <div>
                        <span className="mb-1 block text-[10px] font-bold text-muted-foreground md:hidden">
                          Ends
                        </span>
                        <output className="flex h-11 items-center rounded-2xl border border-border bg-background px-3 text-sm font-black">
                          {endTime ?? "Review"}
                        </output>
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1 md:col-span-1">
                        <Button
                          aria-label={`Move period ${index + 1} up`}
                          disabled={index === 0}
                          onClick={() => movePeriod(index, -1)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          aria-label={`Move period ${index + 1} down`}
                          disabled={index === periods.length - 1}
                          onClick={() => movePeriod(index, 1)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          aria-label={`Remove period ${index + 1}`}
                          disabled={periods.length === 1}
                          onClick={() =>
                            setPeriods((current) =>
                              current.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {period.uncertainFields.length ? (
                        <p className="col-span-2 text-[11px] font-bold text-amber-800 dark:text-amber-300 md:col-span-5">
                          DeepSeek was uncertain about:{" "}
                          {period.uncertainFields
                            .map((field) =>
                              field === "endTime"
                                ? "duration / end time"
                                : field === "startTime"
                                  ? "start time"
                                  : "period number",
                            )
                            .join(", ")}
                          . Edit the highlighted values to confirm them.
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {periodIssues.length ? (
                <div
                  className="mt-4 rounded-2xl bg-red-50 p-4 text-xs font-bold text-red-700 dark:bg-red-400/10 dark:text-red-300"
                  role="alert"
                >
                  <p>Fix these issues before saving:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {[
                      ...new Set(periodIssues.map((issue) => issue.message)),
                    ].map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {canManage ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    onClick={() =>
                      setPeriods((current) => [
                        ...current,
                        {
                          key: `manual-${Date.now()}`,
                          periodNumber:
                            Math.max(
                              0,
                              ...current.map((item) => item.periodNumber),
                            ) + 1,
                          startTime: nextPeriodStart(current),
                          durationMinutes:
                            current.at(-1)?.durationMinutes || 45,
                          uncertainFields: [],
                        },
                      ])
                    }
                    type="button"
                    variant="secondary"
                  >
                    <Plus className="h-4 w-4" /> Add period
                  </Button>
                  <Button
                    disabled={
                      busy ||
                      !periods.length ||
                      periodIssues.length > 0 ||
                      uncertainCount > 0
                    }
                    type="submit"
                  >
                    {busy ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : editingConfigurationId ? (
                      <Pencil className="h-4 w-4" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {editingConfigurationId ? "Update periods" : "Save periods"}
                  </Button>
                  {uncertainCount ? (
                    <span className="self-center text-xs font-bold text-amber-700 dark:text-amber-300">
                      {uncertainCount} period
                      {uncertainCount === 1 ? "" : "s"} still need confirmation
                    </span>
                  ) : null}
                </div>
              ) : null}
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
