"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  FileImage,
  LoaderCircle,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { uploadMediaFile } from "@/lib/client-media";
import {
  formatImportFileSize,
  validateScheduleImportFiles,
} from "@/lib/schedule-import-client";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { DAY_NAMES } from "@/lib/student-schedule";

type University = {
  id: string;
  name: string;
  shortName: string | null;
  campuses: Array<{ id: string; name: string }>;
  academicTerms: Array<{
    id: string;
    name: string;
    campusId: string | null;
    startsOn: string;
    endsOn: string;
    firstWeekStartsOn: string;
    totalWeeks: number;
  }>;
  periodConfigurations: Array<{
    id: string;
    campusId: string | null;
    isDefault: boolean;
  }>;
};
type Course = {
  id: string;
  courseName: string;
  teacher: string | null;
  dayOfWeek: number;
  specificDate: string | null;
  startPeriod: number | null;
  endPeriod: number | null;
  startTime: string;
  endTime: string;
  room: string | null;
  building: string | null;
  campusLabel: string | null;
  startWeek: number | null;
  endWeek: number | null;
  weekPattern: "ALL" | "ODD" | "EVEN" | "CUSTOM";
  weeks: number[];
  language: string | null;
  notes: string | null;
  color: string;
  isOptional: boolean;
  confidence: number | null;
  source: "IMPORT" | "MANUAL";
  createdAt: string;
  updatedAt: string;
};
type Schedule = {
  id: string;
  title: string;
  timezone: string;
  university: { name: string } | null;
  campus: { name: string } | null;
  academicTerm: {
    name: string;
    firstWeekStartsOn: string;
    totalWeeks: number;
  } | null;
  courses: Course[];
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
};
type ReviewCourse = Omit<
  Course,
  "id" | "createdAt" | "updatedAt" | "specificDate"
> & { specificDate?: string | null; uncertainFields?: string[] };
type Review = { title: string; warnings: string[]; courses: ReviewCourse[] };
type ImportStatusPayload = {
  import: {
    id: string;
    status:
      | "UPLOADED"
      | "ANALYZING"
      | "REVIEW_REQUIRED"
      | "CONFIRMED"
      | "FAILED"
      | "CANCELLED";
    processingStage: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    scheduleId: string | null;
    result: { extractedJson: Review } | null;
  };
};

class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string | null,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

const input =
  "h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none transition focus:border-kondo-green";
const analysisSteps = [
  "1. File and quality validation",
  "2. OCR / text extraction",
  "3. Academic structure identification",
  "4. Configuration, duplicate and conflict validation",
  "5. Preview preparation",
  "6. Explicit confirmation",
  "7. Schedule generation",
] as const;
const serverStageLabels: Record<string, string> = {
  FILE_VALIDATION: analysisSteps[0],
  TEXT_EXTRACTION: analysisSteps[1],
  STRUCTURED_EXTRACTION: analysisSteps[2],
  STRUCTURE_VALIDATION: analysisSteps[3],
  REVIEW: analysisSteps[4],
  GENERATING_SCHEDULE: analysisSteps[6],
  COMPLETE: "Complete",
  FAILED: "Analysis stopped",
};
const emptyCourse: ReviewCourse = {
  courseName: "",
  teacher: "",
  dayOfWeek: 1,
  startPeriod: null,
  endPeriod: null,
  startTime: "08:00",
  endTime: "09:30",
  room: "",
  building: "",
  campusLabel: "",
  startWeek: 1,
  endWeek: 18,
  weekPattern: "ALL" as const,
  weeks: [] as number[],
  language: "",
  notes: "",
  color: "#22A06B",
  isOptional: false,
  confidence: null,
  source: "MANUAL" as const,
};

function importFileKind(files: File[]) {
  const kinds = new Set(
    files.map((file) => (file.type === "application/pdf" ? "pdf" : "image")),
  );
  return kinds.size > 1 ? "mixed" : (kinds.values().next().value ?? "unknown");
}

async function api(url: string, body: unknown, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
    retryable?: boolean;
    [key: string]: unknown;
  };
  if (!response.ok)
    throw new ApiRequestError(
      payload.error ?? "The request could not be completed.",
      payload.code ?? null,
      payload.retryable ?? false,
    );
  return payload;
}

async function getImportStatus(importId: string, signal?: AbortSignal) {
  const response = await fetch(`/api/student-hub/imports/${importId}`, {
    credentials: "include",
    signal,
  });
  const payload = (await response.json().catch(() => ({}))) as
    ImportStatusPayload | { error?: string };
  if (!response.ok || !("import" in payload)) {
    throw new Error(
      "error" in payload && payload.error
        ? payload.error
        : "The import status could not be retrieved.",
    );
  }
  return payload.import;
}

export function ScheduleWorkspace({
  universities,
  schedules,
  recentImports,
  initialReview,
}: {
  universities: University[];
  schedules: Schedule[];
  recentImports: Array<{
    id: string;
    status: string;
    processingStage: string | null;
    createdAt: string;
    errorMessage: string | null;
  }>;
  initialReview: { importId: string; result: unknown } | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"week" | "today" | "semester">("week");
  const [selectedSchedule, setSelectedSchedule] = useState(
    schedules[0]?.id ?? "",
  );
  const [showImport, setShowImport] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [analysisStage, setAnalysisStage] = useState("");
  const [error, setError] = useState("");
  const [importError, setImportError] = useState("");
  const [success, setSuccess] = useState("");
  const [review, setReview] = useState<Review | null>(
    (initialReview?.result as Review | undefined) ?? null,
  );
  const [importId, setImportId] = useState(initialReview?.importId ?? "");
  const [pendingImportId, setPendingImportId] = useState("");
  const [selectedImportFiles, setSelectedImportFiles] = useState<File[]>([]);
  const [importConsent, setImportConsent] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
    percent: 0,
    fileName: "",
  });
  const importSubmitLock = useRef(false);
  const [manual, setManual] = useState({ ...emptyCourse });
  const schedule =
    schedules.find((item) => item.id === selectedSchedule) ?? schedules[0];
  const today = new Date().getDay() || 7;
  const visibleCourses = useMemo(
    () =>
      !schedule
        ? []
        : mode === "today"
          ? schedule.courses.filter((course) => course.dayOfWeek === today)
          : schedule.courses,
    [mode, schedule, today],
  );

  useEffect(() => {
    const startedAt = performance.now();
    return () => {
      captureProductEvent(PRODUCT_EVENTS.STUDENT_HUB_TOOL_TIME_SPENT, {
        tool: "timetable",
        duration_seconds:
          Math.round((performance.now() - startedAt) / 100) / 10,
      });
    };
  }, []);

  function updateReview(
    index: number,
    field: keyof ReviewCourse,
    value: unknown,
  ) {
    setReview((current) =>
      current
        ? {
            ...current,
            courses: current.courses.map((course, courseIndex) =>
              courseIndex === index ? { ...course, [field]: value } : course,
            ),
          }
        : current,
    );
  }

  async function importSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || importSubmitLock.current) return;
    if (!importConsent) {
      setImportError(
        "Confirm that you understand how Kondo securely processes your timetable.",
      );
      return;
    }
    const selectionError = pendingImportId
      ? null
      : validateScheduleImportFiles(selectedImportFiles);
    if (selectionError) {
      setImportError(selectionError);
      return;
    }
    importSubmitLock.current = true;
    setBusy(true);
    setImportError("");
    setSuccess("");
    setAnalysisStage("Preparing upload...");
    setUploadProgress({
      current: 0,
      total: selectedImportFiles.length,
      percent: 0,
      fileName: "",
    });
    const stageTimers: Array<ReturnType<typeof setTimeout>> = [];
    const uploadedMediaIds: string[] = [];
    let importCreated = false;
    let currentImportId = pendingImportId;
    let statusPoll: ReturnType<typeof setInterval> | null = null;
    const statusController = new AbortController();
    const operationStartedAt = performance.now();
    captureProductEvent(PRODUCT_EVENTS.STUDENT_HUB_FILE_IMPORT_STARTED, {
      tool: "timetable",
      file_type: pendingImportId
        ? "previously_uploaded"
        : importFileKind(selectedImportFiles),
      file_count: selectedImportFiles.length,
      retry: Boolean(pendingImportId),
    });
    try {
      if (!currentImportId) {
        const form = new FormData(event.currentTarget);
        if (!form.get("universityId")) {
          throw new Error("Choose your university before continuing.");
        }
        for (const [index, file] of selectedImportFiles.entries()) {
          setAnalysisStage(
            `Uploading ${index + 1} of ${selectedImportFiles.length}...`,
          );
          setUploadProgress({
            current: index + 1,
            total: selectedImportFiles.length,
            percent: Math.round((index / selectedImportFiles.length) * 100),
            fileName: file.name,
          });
          uploadedMediaIds.push(
            await uploadMediaFile(file, {
              purpose: "SCHEDULE_IMPORT",
              onProgress: (fileProgress) => {
                setUploadProgress({
                  current: index + 1,
                  total: selectedImportFiles.length,
                  percent: Math.round(
                    ((index + fileProgress / 100) /
                      selectedImportFiles.length) *
                      100,
                  ),
                  fileName: file.name,
                });
              },
            }),
          );
        }
        setAnalysisStage("Validating uploaded files...");
        const created = await api("/api/student-hub/imports", {
          universityId: form.get("universityId"),
          campusId: form.get("campusId") || null,
          academicTermId: form.get("academicTermId") || null,
          mediaIds: uploadedMediaIds,
          retainSource: form.get("retainSource") === "on",
        });
        currentImportId = (created.import as { id: string }).id;
        importCreated = true;
        setPendingImportId(currentImportId);
        captureProductEvent(PRODUCT_EVENTS.STUDENT_HUB_FILE_IMPORT_SUCCEEDED, {
          tool: "timetable",
          file_type: importFileKind(selectedImportFiles),
          file_count: selectedImportFiles.length,
          duration_ms: Math.round(performance.now() - operationStartedAt),
        });
      }
      setAnalysisStage(analysisSteps[0]);
      const generationStartedAt = performance.now();
      captureProductEvent(PRODUCT_EVENTS.STUDENT_HUB_GENERATION_STARTED, {
        tool: "timetable",
        retry: Boolean(pendingImportId),
      });
      stageTimers.push(
        ...analysisSteps
          .slice(1, 5)
          .map((step, index) =>
            setTimeout(
              () => setAnalysisStage(step),
              [1_000, 5_000, 12_000, 20_000, 32_000, 45_000][index],
            ),
          ),
      );
      statusPoll = setInterval(() => {
        void getImportStatus(currentImportId, statusController.signal)
          .then((status) => {
            const label = status.processingStage
              ? serverStageLabels[status.processingStage]
              : null;
            if (label) setAnalysisStage(label);
          })
          .catch(() => null);
      }, 1_500);
      const analyzed = await api(
        `/api/student-hub/imports/${currentImportId}/analyze`,
        {},
      );
      captureProductEvent(PRODUCT_EVENTS.STUDENT_HUB_GENERATION_SUCCEEDED, {
        tool: "timetable",
        result: "review_required",
        duration_ms: Math.round(performance.now() - generationStartedAt),
      });
      setImportId(currentImportId);
      setReview(analyzed.result as Review);
      setShowImport(false);
    } catch (cause) {
      if (currentImportId) {
        try {
          const recovered = await getImportStatus(currentImportId);
          if (recovered.status === "REVIEW_REQUIRED" && recovered.result) {
            setImportId(currentImportId);
            setReview(recovered.result.extractedJson);
            setPendingImportId(currentImportId);
            setShowImport(false);
            captureProductEvent(
              PRODUCT_EVENTS.STUDENT_HUB_GENERATION_SUCCEEDED,
              {
                tool: "timetable",
                result: "review_recovered",
                duration_ms: Math.round(performance.now() - operationStartedAt),
              },
            );
            return;
          }
          if (recovered.status === "FAILED" && recovered.errorMessage) {
            cause = new ApiRequestError(
              recovered.errorMessage,
              recovered.errorCode,
              true,
            );
          }
        } catch {
          // Preserve the original request error when recovery is unavailable.
        }
      }
      captureProductEvent(
        importCreated || pendingImportId
          ? PRODUCT_EVENTS.STUDENT_HUB_GENERATION_FAILED
          : PRODUCT_EVENTS.STUDENT_HUB_FILE_IMPORT_FAILED,
        {
          tool: "timetable",
          error_type:
            cause instanceof ApiRequestError
              ? (cause.code ?? "api_error")
              : cause instanceof Error
                ? cause.name
                : "unknown",
          retryable: cause instanceof ApiRequestError ? cause.retryable : false,
          duration_ms: Math.round(performance.now() - operationStartedAt),
        },
      );
      setImportError(
        cause instanceof Error
          ? cause.message
          : "The timetable could not be analyzed.",
      );
      if (!pendingImportId && !importCreated && uploadedMediaIds.length) {
        await Promise.allSettled(
          uploadedMediaIds.map((mediaId) =>
            fetch(`/api/media/${mediaId}`, {
              method: "DELETE",
              credentials: "include",
            }),
          ),
        );
      }
    } finally {
      statusController.abort();
      if (statusPoll) clearInterval(statusPoll);
      stageTimers.forEach((timer) => clearTimeout(timer));
      setAnalysisStage("");
      setUploadProgress((current) => ({ ...current, percent: 0 }));
      setBusy(false);
      importSubmitLock.current = false;
    }
  }

  async function confirmImport() {
    if (!review || !importId) return;
    setBusy(true);
    setError("");
    try {
      const confirmed = await api(
        `/api/student-hub/imports/${importId}/confirm`,
        {
          title: review.title || "My timetable",
          courses: review.courses.map((course) => {
            const confirmed = { ...course };
            delete confirmed.uncertainFields;
            return confirmed;
          }),
        },
      );
      const scheduleId = (confirmed.schedule as { id: string }).id;
      setReview(null);
      setImportId("");
      setPendingImportId("");
      router.push(`/student-hub/tools/timetables/${scheduleId}?generated=1`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function resumeImport(recoverImportId: string) {
    setBusy(true);
    setError("");
    setImportError("");
    try {
      const recovered = await getImportStatus(recoverImportId);
      if (recovered.status === "REVIEW_REQUIRED" && recovered.result) {
        setImportId(recoverImportId);
        setPendingImportId(recoverImportId);
        setReview(recovered.result.extractedJson);
        setShowImport(false);
        return;
      }
      if (recovered.status === "CONFIRMED" && recovered.scheduleId) {
        router.push(
          `/student-hub/tools/timetables/${recovered.scheduleId}?generated=1`,
        );
        return;
      }
      if (recovered.status === "ANALYZING") {
        setError(
          "Analysis is still running on the server. Wait a moment, then select Check progress again.",
        );
        return;
      }
      setPendingImportId(recoverImportId);
      setSelectedImportFiles([]);
      setImportConsent(false);
      setShowImport(true);
      if (recovered.status === "FAILED") {
        setImportError(
          recovered.errorMessage ??
            "The previous analysis did not finish. Review the guidance and try again.",
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The timetable import could not be recovered.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function addManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      let scheduleId = schedule?.id;
      if (!scheduleId) {
        const created = await api("/api/student-hub/schedules", {
          title: "My timetable",
          timezone: "Asia/Shanghai",
        });
        scheduleId = (created.schedule as { id: string }).id;
      }
      await api(
        editingId
          ? `/api/student-hub/schedules/${scheduleId}/courses/${editingId}`
          : `/api/student-hub/schedules/${scheduleId}/courses`,
        {
          ...manual,
          teacher: manual.teacher || null,
          room: manual.room || null,
          building: manual.building || null,
          campusLabel: manual.campusLabel || null,
          language: manual.language || null,
          notes: manual.notes || null,
        },
        editingId ? "PATCH" : "POST",
      );
      setManual({ ...emptyCourse });
      setEditingId(null);
      setShowManual(false);
      setSuccess(
        editingId ? "Course updated." : "Course added to your timetable.",
      );
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Course could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  function editCourse(course: Course) {
    setManual({
      courseName: course.courseName,
      teacher: course.teacher ?? "",
      dayOfWeek: course.dayOfWeek,
      startPeriod: course.startPeriod,
      endPeriod: course.endPeriod,
      startTime: course.startTime,
      endTime: course.endTime,
      room: course.room ?? "",
      building: course.building ?? "",
      campusLabel: course.campusLabel ?? "",
      startWeek: course.startWeek ?? 1,
      endWeek: course.endWeek ?? 18,
      weekPattern: course.weekPattern,
      weeks: course.weeks,
      language: course.language ?? "",
      notes: course.notes ?? "",
      color: course.color,
      isOptional: course.isOptional,
      confidence: course.confidence,
      source: course.source,
    });
    setEditingId(course.id);
    setShowManual(true);
  }

  async function deleteCourse(courseId: string) {
    if (!schedule || !window.confirm("Delete this course from your timetable?"))
      return;
    setBusy(true);
    setError("");
    try {
      await api(
        `/api/student-hub/schedules/${schedule.id}/courses/${courseId}`,
        {},
        "DELETE",
      );
      setSuccess("Course deleted.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-kondo-green">
            My Tools
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
            Your semester, under control.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Import a timetable, review every detected course, then manage the
            result privately.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              captureProductEvent(PRODUCT_EVENTS.STUDENT_HUB_TOOL_SELECTED, {
                tool: "timetable_import",
              });
              setShowImport(true);
            }}
          >
            <Upload className="h-4 w-4" />
            Import PDF or image
          </Button>
          <Button
            onClick={() => {
              captureProductEvent(PRODUCT_EVENTS.STUDENT_HUB_TOOL_SELECTED, {
                tool: "timetable_manual",
              });
              setShowManual(true);
            }}
            variant="secondary"
          >
            <Plus className="h-4 w-4" />
            Add manually
          </Button>
        </div>
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 dark:bg-red-400/10 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-5 flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300">
          <Check className="h-4 w-4" />
          {success}
        </p>
      ) : null}

      <section className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
            <div>
              {schedules.length ? (
                <select
                  aria-label="Timetable"
                  className={input}
                  onChange={(event) => setSelectedSchedule(event.target.value)}
                  value={schedule?.id}
                >
                  {schedules.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="font-black">My timetable</p>
              )}
            </div>
            <div className="flex rounded-full bg-muted p-1">
              {(["today", "week", "semester"] as const).map((view) => (
                <button
                  className={
                    mode === view
                      ? "rounded-full bg-card px-4 py-2 text-xs font-black shadow-sm"
                      : "px-4 py-2 text-xs font-bold text-muted-foreground"
                  }
                  key={view}
                  onClick={() => setMode(view)}
                  type="button"
                >
                  {view[0]?.toUpperCase()}
                  {view.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {!schedule ? (
            <div className="grid min-h-96 place-items-center p-8 text-center">
              <div>
                <CalendarDays className="mx-auto h-10 w-10 text-kondo-green" />
                <h2 className="mt-4 text-xl font-black">
                  Build your first timetable
                </h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Import your university timetable or add the first course
                  manually. Nothing is saved until you confirm it.
                </p>
              </div>
            </div>
          ) : mode === "week" ? (
            <div className="grid min-w-[760px] grid-cols-7 divide-x divide-border overflow-x-auto">
              {DAY_NAMES.map((day, index) => (
                <div className="min-h-[430px] p-2.5" key={day}>
                  <p className="mb-3 text-center text-xs font-black uppercase tracking-wide text-muted-foreground">
                    {day.slice(0, 3)}
                  </p>
                  <div className="space-y-2">
                    {schedule.courses
                      .filter((course) => course.dayOfWeek === index + 1)
                      .map((course) => (
                        <CourseCard
                          course={course}
                          key={course.id}
                          onDelete={() => deleteCourse(course.id)}
                          onEdit={() => editCourse(course)}
                        />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="min-h-96 p-5">
              <div className="space-y-3">
                {visibleCourses.map((course) => (
                  <CourseRow
                    course={course}
                    key={course.id}
                    onDelete={() => deleteCourse(course.id)}
                    onEdit={() => editCourse(course)}
                  />
                ))}
                {!visibleCourses.length ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">
                    No classes in this view.
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </Card>
        <aside className="space-y-4">
          <Card>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
              Schedule details
            </p>
            <h2 className="mt-2 font-black">
              {schedule?.university?.name ?? "No university selected"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {schedule?.academicTerm?.name ?? "Semester not linked"}
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              {schedule?.timezone ?? "Asia/Shanghai"}
            </div>
          </Card>
          <Card>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
              Recent imports
            </p>
            <div className="mt-3 space-y-2">
              {recentImports.map((item) => (
                <div className="rounded-2xl bg-muted p-3 text-xs" key={item.id}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                    <span className="rounded-full bg-card px-2 py-1 font-black">
                      {item.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  {item.errorMessage ? (
                    <p className="mt-2 leading-5 text-red-700 dark:text-red-300">
                      {item.errorMessage}
                    </p>
                  ) : null}
                  {[
                    "UPLOADED",
                    "ANALYZING",
                    "REVIEW_REQUIRED",
                    "FAILED",
                    "CONFIRMED",
                  ].includes(item.status) ? (
                    <button
                      className="mt-2 font-black text-kondo-green transition hover:underline disabled:cursor-wait disabled:opacity-60"
                      disabled={busy}
                      onClick={() => void resumeImport(item.id)}
                      type="button"
                    >
                      {item.status === "REVIEW_REQUIRED"
                        ? "Resume review"
                        : item.status === "CONFIRMED"
                          ? "Open timetable"
                          : item.status === "ANALYZING"
                            ? "Check progress"
                            : "Retry import"}
                    </button>
                  ) : null}
                </div>
              ))}
              {!recentImports.length ? (
                <p className="text-sm text-muted-foreground">No imports yet.</p>
              ) : null}
            </div>
          </Card>
        </aside>
      </section>

      {showImport ? (
        <Modal
          title="Import your timetable"
          onClose={() => !busy && setShowImport(false)}
        >
          <form aria-busy={busy} onSubmit={importSchedule}>
            <fieldset
              className="space-y-4 disabled:cursor-wait disabled:opacity-70"
              disabled={busy}
            >
              <UniversityFields universities={universities} />
              <label className="block rounded-3xl border-2 border-dashed border-emerald-200 p-6 text-center dark:border-emerald-400/20">
                <FileImage className="mx-auto h-7 w-7 text-kondo-green" />
                <span className="mt-2 block text-sm font-black">
                  PDF, JPG, PNG or WebP
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Up to 5 files, 15 MB each and 10 PDF pages.
                </span>
                <input
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="mt-4 block w-full text-xs"
                  multiple
                  name="files"
                  onChange={(event) => {
                    const files = Array.from(event.currentTarget.files ?? []);
                    setSelectedImportFiles(files);
                    setPendingImportId("");
                    setImportError(validateScheduleImportFiles(files) ?? "");
                  }}
                  type="file"
                />
              </label>
              {selectedImportFiles.length ? (
                <div
                  className="space-y-2 rounded-2xl bg-muted/70 p-3"
                  aria-label="Selected files"
                >
                  {selectedImportFiles.map((file, index) => (
                    <div
                      className="flex items-center justify-between gap-3 text-xs"
                      key={`${file.name}-${file.size}-${index}`}
                    >
                      <span className="min-w-0 truncate font-bold">
                        {file.name}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatImportFileSize(file.size)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : pendingImportId ? (
                <div className="rounded-2xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
                  Your files are securely uploaded and ready for another
                  analysis attempt.
                </div>
              ) : null}
              <label className="flex items-start gap-3 text-xs text-muted-foreground">
                <input className="mt-0.5" name="retainSource" type="checkbox" />
                Keep my source files after confirmation. Otherwise Kondo deletes
                them.
              </label>
              <label className="flex items-start gap-3 text-xs text-muted-foreground">
                <input
                  checked={importConsent}
                  className="mt-0.5"
                  onChange={(event) => {
                    setImportConsent(event.target.checked);
                    if (event.target.checked) setImportError("");
                  }}
                  type="checkbox"
                />
                I understand that Kondo extracts text securely, then sends only
                that text to its configured AI provider. Results that need
                correction is shown for review. Nothing is saved to your
                timetable until you explicitly confirm it.
              </label>
              {busy && uploadProgress.percent > 0 ? (
                <div className="space-y-2" aria-live="polite">
                  <div className="flex items-center justify-between gap-4 text-xs font-bold">
                    <span className="min-w-0 truncate">
                      {uploadProgress.fileName}
                    </span>
                    <span className="shrink-0">{uploadProgress.percent}%</span>
                  </div>
                  <div
                    aria-label="Upload progress"
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={uploadProgress.percent}
                    className="h-2 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                  >
                    <div
                      className="h-full rounded-full bg-kondo-green transition-[width] duration-200"
                      style={{ width: `${uploadProgress.percent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    File {uploadProgress.current} of {uploadProgress.total}.
                    Keep this window open until the upload finishes.
                  </p>
                </div>
              ) : null}
              {busy && analysisSteps.includes(analysisStage as never) ? (
                <ol
                  aria-label="Timetable analysis progress"
                  className="grid gap-1.5 rounded-2xl border border-border bg-muted/35 p-4 sm:grid-cols-2"
                >
                  {analysisSteps.slice(0, 5).map((step, index) => {
                    const activeIndex = analysisSteps.indexOf(
                      analysisStage as (typeof analysisSteps)[number],
                    );
                    const completed = index < activeIndex;
                    const active = index === activeIndex;
                    return (
                      <li
                        aria-current={active ? "step" : undefined}
                        className={
                          active
                            ? "flex items-center gap-2 text-xs font-black text-kondo-green"
                            : completed
                              ? "flex items-center gap-2 text-xs font-bold text-foreground"
                              : "flex items-center gap-2 text-xs text-muted-foreground"
                        }
                        key={step}
                      >
                        {completed ? (
                          <Check className="h-3.5 w-3.5 shrink-0" />
                        ) : active ? (
                          <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" />
                        ) : (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
                        )}
                        {step}
                      </li>
                    );
                  })}
                </ol>
              ) : null}
              {importError ? (
                <div
                  className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 dark:bg-red-400/10 dark:text-red-300"
                  role="alert"
                >
                  <p>{importError}</p>
                  {pendingImportId ? (
                    <p className="mt-1 text-xs font-medium opacity-80">
                      Your uploaded file is still available. You can try the
                      analysis again without uploading it a second time.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <Button disabled={busy} fullWidth type="submit">
                {busy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {busy ? analysisStage || "Analyzing..." : "Analyze timetable"}
              </Button>
            </fieldset>
          </form>
        </Modal>
      ) : null}
      {showManual ? (
        <Modal
          title={editingId ? "Edit course" : "Add a course"}
          onClose={() => {
            if (!busy) {
              setShowManual(false);
              setEditingId(null);
              setManual({ ...emptyCourse });
            }
          }}
        >
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={addManual}>
            <CourseFields
              course={manual}
              onChange={(field, value) =>
                setManual((current) => ({ ...current, [field]: value }))
              }
            />
            <div className="sm:col-span-2">
              <Button disabled={busy} fullWidth type="submit">
                {busy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {editingId ? "Save changes" : "Save course"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
      {review ? (
        <div className="fixed inset-0 z-[80] h-[var(--visual-viewport-height,100dvh)] overflow-y-auto bg-kondo-navy/70 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto max-w-5xl rounded-4xl bg-card p-5 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-kondo-green">
                  Stage 6 of 7 · Review required
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Check before anything is saved
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Yellow fields were uncertain. You remain in control of the
                  final data.
                </p>
              </div>
              <Button
                aria-label="Cancel review"
                onClick={() => setReview(null)}
                size="icon"
                variant="ghost"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            {review.warnings.length ? (
              <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
                {review.warnings.join(" ")}
              </div>
            ) : null}
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-black">
                Timetable name
              </span>
              <input
                className={input}
                onChange={(event) =>
                  setReview((current) =>
                    current
                      ? { ...current, title: event.target.value }
                      : current,
                  )
                }
                value={review.title}
              />
            </label>
            <div className="mt-5 space-y-4">
              {review.courses.map((course, index) => (
                <Card
                  className={
                    course.uncertainFields?.length
                      ? "border-amber-300 dark:border-amber-400/30"
                      : ""
                  }
                  key={`${course.courseName}-${index}`}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-black">Course {index + 1}</p>
                    <div className="flex gap-1">
                      <Button
                        aria-label="Duplicate detected course"
                        onClick={() =>
                          setReview((current) =>
                            current
                              ? {
                                  ...current,
                                  courses: [
                                    ...current.courses.slice(0, index + 1),
                                    { ...course, weeks: [...course.weeks] },
                                    ...current.courses.slice(index + 1),
                                  ],
                                }
                              : current,
                          )
                        }
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        aria-label="Remove detected course"
                        onClick={() =>
                          setReview((current) =>
                            current
                              ? {
                                  ...current,
                                  courses: current.courses.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                }
                              : current,
                          )
                        }
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <CourseFields
                      course={course}
                      onChange={(field, value) =>
                        updateReview(index, field, value)
                      }
                    />
                  </div>
                  {course.uncertainFields?.length ? (
                    <p className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4" />
                      Please verify: {course.uncertainFields.join(", ")}
                    </p>
                  ) : null}
                </Card>
              ))}
            </div>
            <div className="sticky bottom-3 mt-6 flex flex-wrap justify-end gap-3 rounded-3xl border border-border bg-card/95 p-3 backdrop-blur">
              <Button
                onClick={() =>
                  setReview((current) =>
                    current
                      ? {
                          ...current,
                          courses: [...current.courses, { ...emptyCourse }],
                        }
                      : current,
                  )
                }
                variant="secondary"
              >
                <Plus className="h-4 w-4" />
                Add course
              </Button>
              <Button
                disabled={busy || !review.courses.length}
                onClick={confirmImport}
              >
                {busy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {busy ? "Generating schedule…" : "Confirm and save"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[70] grid h-[var(--visual-viewport-height,100dvh)] place-items-start overflow-y-auto bg-kondo-navy/60 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:place-items-center sm:p-4">
      <div className="w-full max-w-2xl rounded-4xl border border-border bg-card p-5 shadow-2xl sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-black">{title}</h2>
          <Button
            aria-label="Close"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function UniversityFields({ universities }: { universities: University[] }) {
  const [selected, setSelected] = useState(universities[0]?.id ?? "");
  const university = universities.find((item) => item.id === selected);
  return (
    <>
      <div>
        <input name="universityId" type="hidden" value={selected} />
        <SearchableSelect
          label="University"
          onSelect={setSelected}
          options={universities.map((item) => ({
            id: item.id,
            name: item.name,
            secondary: item.shortName ?? undefined,
          }))}
          placeholder="Choose university"
          searchPlaceholder="Search universities"
          selected={selected}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="mb-2 block text-sm font-black">Campus</span>
          <select className={input} name="campusId">
            <option value="">All campuses</option>
            {university?.campuses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-2 block text-sm font-black">Semester</span>
          <select className={input} name="academicTermId">
            <option value="">Not specified</option>
            {university?.academicTerms.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {university && !university.periodConfigurations.length ? (
        <p className="rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
          This university has no official period configuration yet. Exact times
          in the document can still be read; numbered periods will be marked for
          review.
        </p>
      ) : null}
    </>
  );
}

function CourseFields({
  course,
  onChange,
}: {
  course: Partial<ReviewCourse> & {
    courseName: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  };
  onChange: (field: keyof ReviewCourse, value: never) => void;
}) {
  return (
    <>
      <label>
        <span className="mb-1 block text-xs font-bold">Course</span>
        <input
          className={input}
          maxLength={200}
          onChange={(event) =>
            onChange("courseName", event.target.value as never)
          }
          required
          value={course.courseName}
        />
      </label>
      <label>
        <span className="mb-1 block text-xs font-bold">Teacher</span>
        <input
          className={input}
          onChange={(event) => onChange("teacher", event.target.value as never)}
          value={course.teacher ?? ""}
        />
      </label>
      <label>
        <span className="mb-1 block text-xs font-bold">Day</span>
        <select
          className={input}
          onChange={(event) =>
            onChange("dayOfWeek", Number(event.target.value) as never)
          }
          value={course.dayOfWeek}
        >
          {DAY_NAMES.map((day, index) => (
            <option key={day} value={index + 1}>
              {day}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-1 block text-xs font-bold">Room</span>
        <input
          className={input}
          onChange={(event) => onChange("room", event.target.value as never)}
          value={course.room ?? ""}
        />
      </label>
      <label>
        <span className="mb-1 block text-xs font-bold">Starts</span>
        <input
          className={input}
          onChange={(event) =>
            onChange("startTime", event.target.value as never)
          }
          required
          type="time"
          value={course.startTime}
        />
      </label>
      <label>
        <span className="mb-1 block text-xs font-bold">Ends</span>
        <input
          className={input}
          onChange={(event) => onChange("endTime", event.target.value as never)}
          required
          type="time"
          value={course.endTime}
        />
      </label>
      <label>
        <span className="mb-1 block text-xs font-bold">First week</span>
        <input
          className={input}
          max={60}
          min={1}
          onChange={(event) =>
            onChange("startWeek", Number(event.target.value) as never)
          }
          type="number"
          value={course.startWeek ?? 1}
        />
      </label>
      <label>
        <span className="mb-1 block text-xs font-bold">Last week</span>
        <input
          className={input}
          max={60}
          min={1}
          onChange={(event) =>
            onChange("endWeek", Number(event.target.value) as never)
          }
          type="number"
          value={course.endWeek ?? 18}
        />
      </label>
      <label>
        <span className="mb-1 block text-xs font-bold">Weeks</span>
        <select
          className={input}
          onChange={(event) =>
            onChange("weekPattern", event.target.value as never)
          }
          value={course.weekPattern ?? "ALL"}
        >
          <option value="ALL">Every week</option>
          <option value="ODD">Odd weeks</option>
          <option value="EVEN">Even weeks</option>
          <option value="CUSTOM">Custom weeks</option>
        </select>
      </label>
      {course.weekPattern === "CUSTOM" ? (
        <label>
          <span className="mb-1 block text-xs font-bold">Week numbers</span>
          <input
            className={input}
            onChange={(event) =>
              onChange(
                "weeks",
                event.target.value
                  .split(",")
                  .map((value) => Number(value.trim()))
                  .filter(
                    (value) =>
                      Number.isInteger(value) && value > 0 && value <= 60,
                  ) as never,
              )
            }
            placeholder="1, 3, 7, 9"
            required
            value={course.weeks?.join(", ") ?? ""}
          />
        </label>
      ) : null}
      <label>
        <span className="mb-1 block text-xs font-bold">Color</span>
        <input
          className={`${input} p-1`}
          onChange={(event) => onChange("color", event.target.value as never)}
          type="color"
          value={course.color ?? "#22A06B"}
        />
      </label>
    </>
  );
}

function CourseCard({
  course,
  onDelete,
  onEdit,
}: {
  course: Course;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      className="group rounded-2xl border-l-4 bg-muted/70 p-3"
      style={{ borderLeftColor: course.color }}
    >
      <p className="line-clamp-2 text-xs font-black">{course.courseName}</p>
      <p className="mt-1 text-[11px] font-bold text-muted-foreground">
        {course.startTime}–{course.endTime}
      </p>
      <p className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">
        {course.room || course.teacher || "Class"}
      </p>
      <button
        aria-label={`Edit ${course.courseName}`}
        className="mt-2 mr-2 inline-flex text-kondo-green"
        onClick={onEdit}
        type="button"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        aria-label={`Delete ${course.courseName}`}
        className="mt-2 inline-flex text-red-600"
        onClick={onDelete}
        type="button"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
function CourseRow({
  course,
  onDelete,
  onEdit,
}: {
  course: Course;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border p-4">
      <span
        className="h-12 w-1 rounded-full"
        style={{ backgroundColor: course.color }}
      />
      <div className="min-w-0 flex-1">
        <p className="font-black">{course.courseName}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {DAY_NAMES[course.dayOfWeek - 1]} · {course.startTime}–
          {course.endTime} {course.room ? `· ${course.room}` : ""}
        </p>
      </div>
      <Button
        aria-label="Edit course"
        onClick={onEdit}
        size="icon"
        variant="ghost"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        aria-label="Delete course"
        onClick={onDelete}
        size="icon"
        variant="ghost"
      >
        <Trash2 className="h-4 w-4 text-red-600" />
      </Button>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
