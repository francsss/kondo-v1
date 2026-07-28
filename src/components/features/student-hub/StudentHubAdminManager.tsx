"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Check,
  Clock3,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

type Period = {
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
  periods: Array<Period & { createdAt: string; updatedAt: string }>;
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

const input =
  "h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-kondo-green";
const initialPeriods: Period[] = [
  {
    periodNumber: 1,
    label: "Period 1",
    startTime: "08:00",
    endTime: "08:45",
    displayOrder: 1,
    part: "MORNING",
    isBreak: false,
    isActive: true,
  },
  {
    periodNumber: 2,
    label: "Period 2",
    startTime: "08:55",
    endTime: "09:40",
    displayOrder: 2,
    part: "MORNING",
    isBreak: false,
    isActive: true,
  },
];

async function send(url: string, body: unknown, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error ?? "The change could not be saved.");
  return data;
}

function durationMinutes(start: string, end: string) {
  const [startHour = 0, startMinute = 0] = start.split(":").map(Number);
  const [endHour = 0, endMinute = 0] = end.split(":").map(Number);
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
}

function normalizedPeriods(periods: Period[]) {
  return periods.map((period, index) => {
    const hour = Number(period.startTime.slice(0, 2));
    return {
      periodNumber: period.periodNumber,
      label: `Period ${period.periodNumber}`,
      startTime: period.startTime,
      endTime: period.endTime,
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
  const [periods, setPeriods] = useState<Period[]>(
    firstConfiguration?.periods.map((period) => ({
      ...period,
      label: `Period ${period.periodNumber}`,
    })) ?? initialPeriods,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const university = universities.find((item) => item.id === universityId);
  const configurationForScope = useMemo(
    () => activeConfiguration(university, campusId),
    [campusId, university],
  );

  function resetPeriodEditor(nextCampusId = "") {
    setCampusId(nextCampusId);
    const existing = activeConfiguration(university, nextCampusId);
    if (existing) {
      setEditingConfigurationId(existing.id);
      setPeriods(
        existing.periods.map((period) => ({
          ...period,
          label: `Period ${period.periodNumber}`,
        })),
      );
    } else {
      setEditingConfigurationId(null);
      setPeriods(initialPeriods.map((period) => ({ ...period })));
    }
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

  async function savePeriods(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!university) return;
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
      setMessage("Official periods saved. Student schedules will use them.");
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
            const configuration = activeConfiguration(selectedUniversity);
            setUniversityId(value);
            setCampusId("");
            setEditingConfigurationId(configuration?.id ?? null);
            setPeriods(
              configuration?.periods.map((period) => ({
                ...period,
                label: `Period ${period.periodNumber}`,
              })) ?? initialPeriods.map((period) => ({ ...period })),
            );
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
          Only university-specific information is configured here: campuses and
          the exact start and end time of each numbered period.
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
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-kondo-green" />
              <div>
                <h2 className="text-lg font-black">Campuses</h2>
                <p className="text-xs text-muted-foreground">
                  Existing campus management is preserved.
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
                  <h2 className="text-lg font-black">Periods</h2>
                  <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
                    Enter only the period number and its start and end time.
                    Duration is calculated automatically.
                  </p>
                </div>
              </div>
              <select
                aria-label="Period campus"
                className={`${input} w-full sm:w-60`}
                onChange={(event) => resetPeriodEditor(event.target.value)}
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

            <form className="mt-5" onSubmit={savePeriods}>
              <div className="space-y-2">
                <div className="hidden grid-cols-[100px_1fr_1fr_100px_44px] gap-2 px-3 text-[10px] font-black uppercase tracking-wide text-muted-foreground sm:grid">
                  <span>Period</span>
                  <span>Starts</span>
                  <span>Ends</span>
                  <span>Duration</span>
                  <span />
                </div>
                {periods.map((period, index) => (
                  <div
                    className="grid grid-cols-[76px_1fr_1fr_40px] gap-2 rounded-2xl bg-muted/65 p-3 sm:grid-cols-[100px_1fr_1fr_100px_44px]"
                    key={`${period.periodNumber}-${index}`}
                  >
                    <label>
                      <span className="mb-1 block text-[10px] font-bold text-muted-foreground sm:hidden">
                        Period
                      </span>
                      <input
                        aria-label="Period number"
                        className={input}
                        min={1}
                        onChange={(event) =>
                          setPeriods((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    periodNumber: Number(event.target.value),
                                  }
                                : item,
                            ),
                          )
                        }
                        required
                        type="number"
                        value={period.periodNumber}
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-[10px] font-bold text-muted-foreground sm:hidden">
                        Starts
                      </span>
                      <input
                        aria-label="Start time"
                        className={input}
                        onChange={(event) =>
                          setPeriods((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, startTime: event.target.value }
                                : item,
                            ),
                          )
                        }
                        required
                        type="time"
                        value={period.startTime}
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-[10px] font-bold text-muted-foreground sm:hidden">
                        Ends
                      </span>
                      <input
                        aria-label="End time"
                        className={input}
                        onChange={(event) =>
                          setPeriods((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, endTime: event.target.value }
                                : item,
                            ),
                          )
                        }
                        required
                        type="time"
                        value={period.endTime}
                      />
                    </label>
                    <span className="hidden self-center text-xs font-black text-muted-foreground sm:block">
                      {Math.max(
                        0,
                        durationMinutes(period.startTime, period.endTime),
                      )}{" "}
                      min
                    </span>
                    <Button
                      aria-label="Remove period"
                      disabled={periods.length === 1}
                      onClick={() =>
                        setPeriods((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              {canManage ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    onClick={() =>
                      setPeriods((current) => [
                        ...current,
                        {
                          periodNumber:
                            Math.max(
                              0,
                              ...current.map((item) => item.periodNumber),
                            ) + 1,
                          label: "",
                          startTime: "10:00",
                          endTime: "10:45",
                          displayOrder: current.length + 1,
                          part: null,
                          isBreak: false,
                          isActive: true,
                        },
                      ])
                    }
                    type="button"
                    variant="secondary"
                  >
                    <Plus className="h-4 w-4" /> Add period
                  </Button>
                  <Button disabled={busy || !periods.length} type="submit">
                    {busy ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : editingConfigurationId ? (
                      <Pencil className="h-4 w-4" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {editingConfigurationId ? "Update periods" : "Save periods"}
                  </Button>
                </div>
              ) : null}
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
