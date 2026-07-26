"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  LoaderCircle,
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
type Term = {
  id: string;
  campusId: string | null;
  name: string;
  startsOn: string;
  endsOn: string;
  firstWeekStartsOn: string;
  totalWeeks: number;
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
  academicTerms: Term[];
  periodConfigurations: Configuration[];
};
const input =
  "h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none focus:border-kondo-green";
const defaultPeriods: Period[] = [
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

export function StudentHubAdminManager({
  universities,
  canManage,
}: {
  universities: University[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [universityId, setUniversityId] = useState(universities[0]?.id ?? "");
  const [periods, setPeriods] = useState<Period[]>(defaultPeriods);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const university = universities.find((item) => item.id === universityId);
  async function submit(
    form: HTMLFormElement,
    url: string,
    body: Record<string, unknown>,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await send(url, body);
      form.reset();
      setMessage("Saved to the Student Hub configuration.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-7 space-y-6">
      <Card>
        <SearchableSelect
          label="University"
          onSelect={setUniversityId}
          options={universities.map((item) => ({
            id: item.id,
            name: item.name,
            secondary: item.shortName ?? undefined,
          }))}
          placeholder="Choose university"
          searchPlaceholder="Search universities"
          selected={universityId}
        />
        {university &&
        !university.periodConfigurations.some((item) => item.isActive) ? (
          <p className="mt-4 flex items-center gap-2 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            No active official period configuration. Numbered timetable periods
            cannot be converted automatically.
          </p>
        ) : null}
      </Card>
      {error ? (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          <Check className="h-4 w-4" />
          {message}
        </p>
      ) : null}
      {university ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-kondo-green" />
              <h2 className="text-lg font-black">Campuses</h2>
            </div>
            <div className="mt-4 space-y-2">
              {university.campuses.map((campus) => (
                <div className="rounded-2xl bg-muted p-3" key={campus.id}>
                  <p className="text-sm font-black">{campus.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {campus.address || "No address"} ·{" "}
                    {campus.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
              ))}
            </div>
            {canManage ? (
              <form
                className="mt-5 grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  void submit(
                    form,
                    `/api/admin/student-hub/universities/${university.id}/campuses`,
                    {
                      name: data.get("name"),
                      address: data.get("address") || null,
                      isActive: true,
                    },
                  );
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
                  <Plus className="h-4 w-4" />
                  Add campus
                </Button>
              </form>
            ) : null}
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-kondo-green" />
              <h2 className="text-lg font-black">Academic terms</h2>
            </div>
            <div className="mt-4 space-y-2">
              {university.academicTerms.map((term) => (
                <div className="rounded-2xl bg-muted p-3" key={term.id}>
                  <p className="text-sm font-black">{term.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {term.startsOn} → {term.endsOn} · {term.totalWeeks} weeks
                  </p>
                </div>
              ))}
            </div>
            {canManage ? (
              <form
                className="mt-5 grid gap-3 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  void submit(
                    form,
                    `/api/admin/student-hub/universities/${university.id}/terms`,
                    {
                      campusId: data.get("campusId") || null,
                      name: data.get("name"),
                      startsOn: data.get("startsOn"),
                      endsOn: data.get("endsOn"),
                      firstWeekStartsOn: data.get("firstWeekStartsOn"),
                      totalWeeks: data.get("totalWeeks"),
                      isActive: true,
                    },
                  );
                }}
              >
                <select className={input} name="campusId">
                  <option value="">All campuses</option>
                  {university.campuses.map((campus) => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
                </select>
                <input
                  className={input}
                  name="name"
                  placeholder="2026 Spring"
                  required
                />
                <label className="text-xs font-bold">
                  Starts
                  <input
                    className={`${input} mt-1`}
                    name="startsOn"
                    required
                    type="date"
                  />
                </label>
                <label className="text-xs font-bold">
                  Ends
                  <input
                    className={`${input} mt-1`}
                    name="endsOn"
                    required
                    type="date"
                  />
                </label>
                <label className="text-xs font-bold">
                  Week 1 starts
                  <input
                    className={`${input} mt-1`}
                    name="firstWeekStartsOn"
                    required
                    type="date"
                  />
                </label>
                <label className="text-xs font-bold">
                  Total weeks
                  <input
                    className={`${input} mt-1`}
                    defaultValue={18}
                    max={60}
                    min={1}
                    name="totalWeeks"
                    required
                    type="number"
                  />
                </label>
                <Button className="sm:col-span-2" disabled={busy} type="submit">
                  <Plus className="h-4 w-4" />
                  Add semester
                </Button>
              </form>
            ) : null}
          </Card>
        </div>
      ) : null}
      {university ? (
        <Card>
          <div className="flex items-center gap-3">
            <Clock3 className="h-5 w-5 text-kondo-green" />
            <div>
              <h2 className="text-lg font-black">Official class periods</h2>
              <p className="text-xs text-muted-foreground">
                Versioned mappings used when an imported timetable contains
                第1-2节 or numbered periods.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {university.periodConfigurations.map((configuration) => (
              <div
                className="rounded-3xl border border-border p-4"
                key={configuration.id}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-black">{configuration.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {configuration.campus?.name ?? "University-wide"} · v
                      {configuration.version}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {configuration.isDefault ? (
                      <span className="rounded-full bg-kondo-mint px-2 py-1 text-[10px] font-black text-kondo-forest">
                        DEFAULT
                      </span>
                    ) : null}
                    <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-black">
                      {configuration.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {configuration.periods.length} periods ·{" "}
                  {configuration.timezone} · {configuration.primaryLanguage}
                </p>
              </div>
            ))}
          </div>
          {canManage ? (
            <form
              className="mt-7"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                void submit(
                  form,
                  `/api/admin/student-hub/universities/${university.id}/period-configurations`,
                  {
                    campusId: data.get("campusId") || null,
                    name: data.get("name"),
                    timezone: data.get("timezone"),
                    primaryLanguage: data.get("primaryLanguage"),
                    isActive: true,
                    isDefault: data.get("isDefault") === "on",
                    periods,
                  },
                );
              }}
            >
              <div className="grid gap-3 md:grid-cols-4">
                <input
                  className={input}
                  name="name"
                  placeholder="Standard periods"
                  required
                />
                <select className={input} name="campusId">
                  <option value="">University-wide</option>
                  {university.campuses.map((campus) => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
                </select>
                <input
                  className={input}
                  defaultValue="Asia/Shanghai"
                  name="timezone"
                  required
                />
                <input
                  className={input}
                  defaultValue="zh-CN"
                  name="primaryLanguage"
                  required
                />
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm font-bold">
                <input name="isDefault" type="checkbox" />
                Use as default for this scope
              </label>
              <div className="mt-5 space-y-2">
                {periods.map((period, index) => (
                  <div
                    className="grid gap-2 rounded-2xl bg-muted p-3 sm:grid-cols-[80px_minmax(120px,1fr)_130px_130px_44px]"
                    key={index}
                  >
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
                                  displayOrder: Number(event.target.value),
                                }
                              : item,
                          ),
                        )
                      }
                      type="number"
                      value={period.periodNumber}
                    />
                    <input
                      aria-label="Period label"
                      className={input}
                      onChange={(event) =>
                        setPeriods((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, label: event.target.value }
                              : item,
                          ),
                        )
                      }
                      value={period.label}
                    />
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
                      type="time"
                      value={period.startTime}
                    />
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
                      type="time"
                      value={period.endTime}
                    />
                    <Button
                      aria-label="Remove period"
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
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  onClick={() =>
                    setPeriods((current) => [
                      ...current,
                      {
                        periodNumber: current.length + 1,
                        label: `Period ${current.length + 1}`,
                        startTime: "10:00",
                        endTime: "10:45",
                        displayOrder: current.length + 1,
                        part: "MORNING",
                        isBreak: false,
                        isActive: true,
                      },
                    ])
                  }
                  type="button"
                  variant="secondary"
                >
                  <Plus className="h-4 w-4" />
                  Add period
                </Button>
                <Button disabled={busy || !periods.length} type="submit">
                  {busy ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Save official configuration
                </Button>
              </div>
            </form>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
