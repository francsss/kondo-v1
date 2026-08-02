"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  FileImage,
  GraduationCap,
  LayoutDashboard,
  ListTodo,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
  type LucideIcon,
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
import {
  academicCalendarPosition,
  academicWeekDates,
  deriveTodayCourses,
  isPendingAcademicTask,
} from "@/lib/student-academic-tools";
import { DAY_NAMES, formatCourseTime } from "@/lib/student-schedule";
import { cn } from "@/lib/utils";

type University = {
  id: string;
  name: string;
  shortName: string | null;
  campuses: Array<{ id: string; name: string }>;
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
  startTime: string | null;
  endTime: string | null;
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
type AcademicTask = {
  id: string;
  scheduleId: string | null;
  courseId: string | null;
  title: string;
  description: string | null;
  kind: "ASSIGNMENT" | "PROJECT" | "EXAM" | "REMINDER" | "EVENT";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueAt: string | null;
  reminderAt: string | null;
  completedAt: string | null;
  course: { id: string; courseName: string; color: string } | null;
  createdAt: string;
  updatedAt: string;
};
type AcademicTaskDraft = {
  title: string;
  description: string;
  kind: AcademicTask["kind"];
  priority: AcademicTask["priority"];
  dueAt: string;
  courseId: string;
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
const emptyTask: AcademicTaskDraft = {
  title: "",
  description: "",
  kind: "ASSIGNMENT",
  priority: "MEDIUM",
  dueAt: "",
  courseId: "",
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
  userName,
  initialSection,
  initialScheduleId,
  initialSuccess,
  universities,
  schedules,
  tasks,
  recentImports,
  initialReview,
}: {
  userName: string;
  initialSection: "today" | "schedule" | "tasks";
  initialScheduleId?: string;
  initialSuccess?: string;
  universities: University[];
  schedules: Schedule[];
  tasks: AcademicTask[];
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
  const [section, setSection] = useState<"today" | "schedule" | "tasks">(
    initialSection,
  );
  const [mode, setMode] = useState<"week" | "month" | "semester">("week");
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [selectedSchedule, setSelectedSchedule] = useState(
    schedules.some((schedule) => schedule.id === initialScheduleId)
      ? initialScheduleId!
      : (schedules[0]?.id ?? ""),
  );
  const [showImport, setShowImport] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<AcademicTaskDraft>({
    ...emptyTask,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [analysisStage, setAnalysisStage] = useState("");
  const [error, setError] = useState("");
  const [importError, setImportError] = useState("");
  const [success, setSuccess] = useState(initialSuccess ?? "");
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
  const todaySummary = useMemo(
    () =>
      deriveTodayCourses(
        schedule?.courses ?? [],
        new Date(),
        schedule?.timezone ?? "Asia/Shanghai",
      ),
    [schedule],
  );
  const pendingTasks = useMemo(
    () =>
      tasks.filter(isPendingAcademicTask).sort((left, right) => {
        if (!left.dueAt) return 1;
        if (!right.dueAt) return -1;
        return new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
      }),
    [tasks],
  );
  const upcomingExams = pendingTasks.filter((task) => task.kind === "EXAM");
  const upcomingEvents = pendingTasks.filter((task) => task.kind === "EVENT");
  const weekDates = useMemo(() => academicWeekDates(weekAnchor), [weekAnchor]);

  function changeSection(nextSection: "today" | "schedule" | "tasks") {
    setSection(nextSection);
    const params = new URLSearchParams({ view: nextSection });
    if (selectedSchedule) params.set("schedule", selectedSchedule);
    router.replace(`/student-hub/tools?${params.toString()}`, {
      scroll: false,
    });
  }

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
            return {
              ...confirmed,
              startTime: confirmed.startTime || null,
              endTime: confirmed.endTime || null,
            };
          }),
        },
      );
      const scheduleId = (confirmed.schedule as { id: string }).id;
      setReview(null);
      setImportId("");
      setPendingImportId("");
      setSection("schedule");
      setSelectedSchedule(scheduleId);
      router.push(
        `/student-hub/tools?view=schedule&schedule=${scheduleId}&generated=1`,
      );
      router.refresh();
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
          `/student-hub/tools?view=schedule&schedule=${recovered.scheduleId}&generated=1`,
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

  function openTask(task?: AcademicTask) {
    if (task) {
      setEditingTaskId(task.id);
      setTaskDraft({
        title: task.title,
        description: task.description ?? "",
        kind: task.kind,
        priority: task.priority,
        dueAt: task.dueAt
          ? new Date(task.dueAt).toISOString().slice(0, 16)
          : "",
        courseId: task.courseId ?? "",
      });
    } else {
      setEditingTaskId(null);
      setTaskDraft({ ...emptyTask });
    }
    setShowTask(true);
  }

  async function saveTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        editingTaskId
          ? `/api/student-hub/tasks/${editingTaskId}`
          : "/api/student-hub/tasks",
        {
          scheduleId: schedule?.id ?? null,
          courseId: taskDraft.courseId || null,
          title: taskDraft.title,
          description: taskDraft.description || null,
          kind: taskDraft.kind,
          priority: taskDraft.priority,
          status: editingTaskId
            ? tasks.find((task) => task.id === editingTaskId)?.status
            : "PENDING",
          dueAt: taskDraft.dueAt
            ? new Date(taskDraft.dueAt).toISOString()
            : null,
          reminderAt: null,
        },
        editingTaskId ? "PATCH" : "POST",
      );
      setSuccess(editingTaskId ? "Task updated." : "Task added.");
      setShowTask(false);
      setEditingTaskId(null);
      setTaskDraft({ ...emptyTask });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Task save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleTask(task: AcademicTask) {
    setBusy(true);
    setError("");
    try {
      await api(
        `/api/student-hub/tasks/${task.id}`,
        {
          status: task.status === "COMPLETED" ? "PENDING" : "COMPLETED",
        },
        "PATCH",
      );
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Task update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTask(task: AcademicTask) {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/student-hub/tasks/${task.id}`, {}, "DELETE");
      setSuccess("Task deleted.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Task delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] px-3 pb-24 pt-5 sm:px-6 lg:px-8 lg:pt-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-kondo-green">
            Student Hub · Study planner
          </p>
          <h1 className="mt-1.5 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
            Your academic day, organized.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            One reliable place for classes, deadlines and everything coming
            next.
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <Button onClick={() => setShowImport(true)} size="sm">
            <Upload className="h-4 w-4" /> Import timetable
          </Button>
        </div>
      </div>

      <nav
        aria-label="Academic tools"
        className="mt-6 grid grid-cols-3 border-b border-border"
      >
        {(
          [
            ["today", "Today", LayoutDashboard],
            ["schedule", "Schedule", CalendarDays],
            ["tasks", "Tasks", ListTodo],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            aria-current={section === value ? "page" : undefined}
            className={`relative flex min-h-12 items-center justify-center gap-2 px-2 text-sm font-black transition ${
              section === value
                ? "text-kondo-green"
                : "text-muted-foreground hover:text-foreground"
            }`}
            key={value}
            onClick={() => changeSection(value)}
            type="button"
          >
            <Icon className="h-4 w-4" />
            {label}
            <span
              className={`absolute inset-x-[18%] bottom-0 h-0.5 rounded-full bg-kondo-green transition-all duration-300 ${
                section === value
                  ? "scale-x-100 opacity-100"
                  : "scale-x-0 opacity-0"
              }`}
            />
          </button>
        ))}
      </nav>

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

      {section === "today" ? (
        <section className="mt-6 space-y-5">
          <div className="rounded-[2rem] border border-border bg-gradient-to-br from-card via-card to-kondo-mint/35 p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-muted-foreground">
                  {new Intl.DateTimeFormat("en", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    timeZone: schedule?.timezone ?? "Asia/Shanghai",
                  }).format(new Date())}
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">
                  Good day, {userName}.
                </h2>
              </div>
              <div className="grid w-full grid-cols-3 gap-2 sm:w-auto">
                <QuickAction
                  icon={Upload}
                  label="Import"
                  onClick={() => setShowImport(true)}
                />
                <QuickAction
                  icon={Plus}
                  label="Course"
                  onClick={() => setShowManual(true)}
                />
                <QuickAction
                  icon={ListTodo}
                  label="Task"
                  onClick={() => openTask()}
                />
              </div>
            </div>
          </div>

          {!schedule ? (
            <AcademicEmptyState
              onImport={() => setShowImport(true)}
              onManual={() => setShowManual(true)}
            />
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FocusClassCard
                    course={todaySummary.current}
                    eyebrow="Current class"
                    empty="No class is running now"
                  />
                  <FocusClassCard
                    course={todaySummary.next}
                    eyebrow="Next class"
                    empty="No more classes today"
                  />
                </div>
                <Card className="p-0">
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
                        Today&apos;s schedule
                      </p>
                      <h3 className="mt-1 font-black">
                        {todaySummary.today.length} class
                        {todaySummary.today.length === 1 ? "" : "es"}
                      </h3>
                    </div>
                    <Button
                      onClick={() => changeSection("schedule")}
                      size="sm"
                      variant="ghost"
                    >
                      Full schedule <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="divide-y divide-border">
                    {todaySummary.today.map((course) => (
                      <TodayCourseRow course={course} key={course.id} />
                    ))}
                    {!todaySummary.today.length ? (
                      <p className="px-5 py-12 text-center text-sm text-muted-foreground">
                        Nothing scheduled today.
                      </p>
                    ) : null}
                  </div>
                </Card>
              </div>

              <aside className="space-y-4">
                <TodayCollection
                  empty="No pending work."
                  icon={ListTodo}
                  items={pendingTasks.filter(
                    (task) => !["EXAM", "EVENT"].includes(task.kind),
                  )}
                  onOpen={() => changeSection("tasks")}
                  title="Pending tasks"
                />
                <TodayCollection
                  empty="No upcoming exams."
                  icon={GraduationCap}
                  items={upcomingExams}
                  onOpen={() => changeSection("tasks")}
                  title="Upcoming exams"
                />
                <TodayCollection
                  empty="No upcoming events."
                  icon={CalendarDays}
                  items={upcomingEvents}
                  onOpen={() => changeSection("tasks")}
                  title="Upcoming events"
                />
              </aside>
            </div>
          )}
        </section>
      ) : null}

      {section === "schedule" ? (
        <section className="mt-6">
          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:p-5">
              <div>
                {schedules.length ? (
                  <select
                    aria-label="Timetable"
                    className={input}
                    onChange={(event) =>
                      setSelectedSchedule(event.target.value)
                    }
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
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowManual(true)}
                  size="sm"
                  variant="secondary"
                >
                  <Plus className="h-4 w-4" /> Class
                </Button>
                <Button onClick={() => setShowImport(true)} size="sm">
                  <Upload className="h-4 w-4" /> Import
                </Button>
              </div>
            </div>
            <div className="border-b border-border px-4 pt-2 sm:px-5">
              <div className="grid grid-cols-3">
                {(["week", "month", "semester"] as const).map((view) => (
                  <button
                    className={`relative min-h-11 text-sm font-black transition ${
                      mode === view
                        ? "text-kondo-green"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    key={view}
                    onClick={() => setMode(view)}
                    type="button"
                  >
                    {view[0]?.toUpperCase()}
                    {view.slice(1)}
                    <span
                      className={`absolute inset-x-[22%] bottom-0 h-0.5 rounded-full bg-kondo-green transition-transform ${
                        mode === view ? "scale-x-100" : "scale-x-0"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            {!schedule ? (
              <AcademicEmptyState
                onImport={() => setShowImport(true)}
                onManual={() => setShowManual(true)}
              />
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
                  <Button
                    aria-label="Previous week"
                    onClick={() =>
                      setWeekAnchor((current) => {
                        const previous = new Date(current);
                        previous.setDate(current.getDate() - 7);
                        return previous;
                      })
                    }
                    size="icon"
                    variant="ghost"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div className="text-center">
                    <p className="text-sm font-black">
                      {formatWeekRange(weekDates)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {schedule.university?.name ?? "My university"}
                      {schedule.campus?.name
                        ? ` · ${schedule.campus.name}`
                        : ""}
                    </p>
                  </div>
                  <Button
                    aria-label="Next week"
                    onClick={() =>
                      setWeekAnchor((current) => {
                        const next = new Date(current);
                        next.setDate(current.getDate() + 7);
                        return next;
                      })
                    }
                    size="icon"
                    variant="ghost"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
                {mode === "week" ? (
                  <WeekScheduleGrid
                    courses={schedule.courses}
                    dates={weekDates}
                    onDelete={deleteCourse}
                    onEdit={editCourse}
                  />
                ) : (
                  <ScheduleCourseList
                    courses={schedule.courses}
                    mode={mode}
                    onDelete={deleteCourse}
                    onEdit={editCourse}
                  />
                )}
              </>
            )}
          </Card>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Card>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
                Schedule details
              </p>
              <h2 className="mt-2 font-black">
                {schedule?.university?.name ?? "No university selected"}
              </h2>
              <p className="mt-2 flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                {schedule?.timezone ?? "Asia/Shanghai"}
              </p>
              {schedule?.campus?.name ? (
                <p className="mt-2 flex items-center gap-2 text-xs font-bold text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {schedule.campus.name}
                </p>
              ) : null}
            </Card>
            <Card>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
                Recent imports
              </p>
              <div className="mt-3 space-y-2">
                {recentImports.slice(0, 3).map((item) => (
                  <button
                    className="flex w-full items-center justify-between rounded-2xl bg-muted p-3 text-left text-xs transition hover:bg-kondo-mint/50"
                    disabled={busy}
                    key={item.id}
                    onClick={() => void resumeImport(item.id)}
                    type="button"
                  >
                    <span className="font-bold">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                    <span className="font-black">
                      {item.status.replaceAll("_", " ")}
                    </span>
                  </button>
                ))}
                {!recentImports.length ? (
                  <p className="text-sm text-muted-foreground">
                    No imports yet.
                  </p>
                ) : null}
              </div>
            </Card>
          </div>
        </section>
      ) : null}

      {section === "tasks" ? (
        <section className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
                Coursework
              </p>
              <h2 className="mt-1 text-2xl font-black">Tasks and deadlines</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Every task can be connected directly to one of your courses.
              </p>
            </div>
            <Button onClick={() => openTask()}>
              <Plus className="h-4 w-4" /> Add task
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <TaskMetric
              label="Pending"
              value={pendingTasks.length}
              tone="emerald"
            />
            <TaskMetric
              label="Exams"
              value={upcomingExams.length}
              tone="violet"
            />
            <TaskMetric
              label="Completed"
              value={tasks.filter((task) => task.status === "COMPLETED").length}
              tone="blue"
            />
          </div>
          <Card className="p-0">
            <div className="divide-y divide-border">
              {tasks.map((task) => (
                <TaskRow
                  disabled={busy}
                  key={task.id}
                  onDelete={() => void deleteTask(task)}
                  onEdit={() => openTask(task)}
                  onToggle={() => void toggleTask(task)}
                  task={task}
                />
              ))}
              {!tasks.length ? (
                <div className="px-5 py-16 text-center">
                  <ListTodo className="mx-auto h-9 w-9 text-kondo-green" />
                  <h3 className="mt-3 font-black">No academic tasks yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add an assignment, exam, project, reminder or event.
                  </p>
                </div>
              ) : null}
            </div>
          </Card>
        </section>
      ) : null}

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
      {showTask ? (
        <Modal
          title={editingTaskId ? "Edit task" : "Add an academic task"}
          onClose={() => {
            if (!busy) {
              setShowTask(false);
              setEditingTaskId(null);
              setTaskDraft({ ...emptyTask });
            }
          }}
        >
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveTask}>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-bold">Task</span>
              <input
                className={input}
                maxLength={200}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Submit research paper"
                required
                value={taskDraft.title}
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold">Type</span>
              <select
                className={input}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    kind: event.target.value as AcademicTask["kind"],
                  }))
                }
                value={taskDraft.kind}
              >
                <option value="ASSIGNMENT">Assignment</option>
                <option value="PROJECT">Project</option>
                <option value="EXAM">Exam</option>
                <option value="REMINDER">Reminder</option>
                <option value="EVENT">Event</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold">Priority</span>
              <select
                className={input}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    priority: event.target.value as AcademicTask["priority"],
                  }))
                }
                value={taskDraft.priority}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold">Course</span>
              <select
                className={input}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    courseId: event.target.value,
                  }))
                }
                value={taskDraft.courseId}
              >
                <option value="">General</option>
                {schedule?.courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.courseName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold">Due date</span>
              <input
                className={input}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    dueAt: event.target.value,
                  }))
                }
                type="datetime-local"
                value={taskDraft.dueAt}
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-bold">
                Notes (optional)
              </span>
              <textarea
                className="min-h-28 w-full rounded-2xl border border-border bg-background p-3 text-sm outline-none transition focus:border-kondo-green"
                maxLength={2000}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                value={taskDraft.description}
              />
            </label>
            <Button className="sm:col-span-2" disabled={busy} type="submit">
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {editingTaskId ? "Save changes" : "Add task"}
            </Button>
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

function formatWeekRange(dates: Date[]) {
  const first = dates[0];
  const last = dates.at(-1);
  if (!first || !last) return "";
  const firstLabel = first.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });
  const lastLabel = last.toLocaleDateString("en", {
    month: first.getMonth() === last.getMonth() ? undefined : "short",
    day: "numeric",
    year: "numeric",
  });
  return `${firstLabel} – ${lastLabel}`;
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 text-xs font-black shadow-sm transition hover:-translate-y-0.5 hover:border-kondo-green/40 hover:shadow-md active:translate-y-0"
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4 text-kondo-green" />
      {label}
    </button>
  );
}

function FocusClassCard({
  course,
  eyebrow,
  empty,
}: {
  course: Course | null;
  eyebrow: string;
  empty: string;
}) {
  return (
    <Card className="relative min-h-40 overflow-hidden">
      <span
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: course?.color ?? "var(--border)" }}
      />
      <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
        {eyebrow}
      </p>
      {course ? (
        <>
          <h3 className="mt-3 text-xl font-black tracking-[-0.025em]">
            {course.courseName}
          </h3>
          <p className="mt-2 flex items-center gap-2 text-sm font-bold text-muted-foreground">
            <Clock3 className="h-4 w-4" /> {formatCourseTime(course)}
          </p>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {course.room || course.campusLabel || "Room not specified"}
          </p>
        </>
      ) : (
        <p className="mt-7 text-sm font-bold text-muted-foreground">{empty}</p>
      )}
    </Card>
  );
}

function TodayCourseRow({ course }: { course: Course }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="w-[72px] shrink-0">
        <p className="text-sm font-black">{course.startTime ?? "—"}</p>
        <p className="text-[11px] text-muted-foreground">
          {course.endTime ?? formatCourseTime(course)}
        </p>
      </div>
      <span
        className="h-11 w-1 rounded-full"
        style={{ backgroundColor: course.color }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-black">{course.courseName}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {[course.room, course.teacher].filter(Boolean).join(" · ") ||
            "Class details"}
        </p>
      </div>
    </div>
  );
}

function TodayCollection({
  title,
  icon: Icon,
  items,
  empty,
  onOpen,
}: {
  title: string;
  icon: LucideIcon;
  items: AcademicTask[];
  empty: string;
  onOpen: () => void;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-black">
          <Icon className="h-4 w-4 text-kondo-green" /> {title}
        </p>
        <button
          className="text-xs font-black text-kondo-green"
          onClick={onOpen}
          type="button"
        >
          View all
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {items.slice(0, 3).map((task) => (
          <div className="rounded-2xl bg-muted/70 p-3" key={task.id}>
            <p className="line-clamp-1 text-sm font-black">{task.title}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {task.course?.courseName ?? task.kind.replaceAll("_", " ")}
              {task.dueAt ? ` · ${formatTaskDue(task.dueAt)}` : ""}
            </p>
          </div>
        ))}
        {!items.length ? (
          <p className="py-3 text-xs text-muted-foreground">{empty}</p>
        ) : null}
      </div>
    </Card>
  );
}

function AcademicEmptyState({
  onImport,
  onManual,
}: {
  onImport: () => void;
  onManual: () => void;
}) {
  return (
    <div className="grid min-h-[420px] place-items-center p-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-kondo-mint text-kondo-forest">
          <BookOpen className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-2xl font-black">
          Build your academic workspace
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Import a university timetable or add your first class. Kondo will
          generate Today and Schedule automatically after confirmation.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={onImport}>
            <Upload className="h-4 w-4" /> Import timetable
          </Button>
          <Button onClick={onManual} variant="secondary">
            <Plus className="h-4 w-4" /> Add class
          </Button>
        </div>
      </div>
    </div>
  );
}

function WeekScheduleGrid({
  courses,
  dates,
  onEdit,
  onDelete,
}: {
  courses: Course[];
  dates: Date[];
  onEdit: (course: Course) => void;
  onDelete: (courseId: string) => Promise<void>;
}) {
  const hours = Array.from({ length: 11 }, (_, index) => index + 8);
  const todayKey = new Date().toDateString();
  const [mobileDay, setMobileDay] = useState(() => new Date().getDay() || 7);
  const dayStripRef = useRef<HTMLDivElement | null>(null);
  const dayPagerRef = useRef<HTMLDivElement | null>(null);

  function coursesForDay(dayNumber: number) {
    return courses
      .filter((course) => course.dayOfWeek === dayNumber)
      .sort((left, right) =>
        String(left.startTime ?? left.startPeriod).localeCompare(
          String(right.startTime ?? right.startPeriod),
        ),
      );
  }

  // Keep the day strip and the swipeable pager showing the same day, whichever
  // one the student used.
  useEffect(() => {
    const strip = dayStripRef.current;
    const active = strip?.querySelector<HTMLElement>(
      `[data-day="${mobileDay}"]`,
    );
    if (strip && active) {
      strip.scrollTo({
        left: active.offsetLeft - (strip.clientWidth - active.clientWidth) / 2,
        behavior: "smooth",
      });
    }
  }, [mobileDay]);

  /**
   * The pager is the single source of truth for the visible day: tapping a day
   * scrolls it, and scrolling it updates the highlight. One direction only, so
   * the two controls can never fight each other into an inconsistent state.
   */
  function showDay(dayNumber: number) {
    // `scrollIntoView` cooperates with mandatory scroll snapping, where a
    // smooth `scrollTo` on the container gets snapped straight back.
    dayPagerRef.current?.children[dayNumber - 1]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });
    setMobileDay(dayNumber);
  }

  function onPagerScroll() {
    const pager = dayPagerRef.current;
    if (!pager || !pager.clientWidth) return;
    const day = Math.round(pager.scrollLeft / pager.clientWidth) + 1;
    if (day >= 1 && day <= 7 && day !== mobileDay) setMobileDay(day);
  }

  return (
    <>
      {/* Mobile: a swipeable day calendar rather than a flat list. The day
          strip scrolls horizontally, and swiping the panel moves between days
          exactly as a native calendar does. Desktop is untouched below. */}
      <div className="border-t border-border md:hidden">
        <div
          aria-label="Select a day"
          className="subnav-row gap-1 border-b border-border bg-muted/25 px-2 py-2"
          ref={dayStripRef}
          role="tablist"
        >
          {dates.map((date, index) => {
            const dayNumber = index + 1;
            const active = mobileDay === dayNumber;
            const count = coursesForDay(dayNumber).length;
            const isToday = date.toDateString() === todayKey;
            return (
              <button
                aria-selected={active}
                className={cn(
                  "flex min-h-16 w-[3.25rem] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 transition",
                  active
                    ? "bg-kondo-green text-white shadow-sm"
                    : "text-muted-foreground hover:bg-muted",
                )}
                data-day={dayNumber}
                key={date.toISOString()}
                onClick={() => showDay(dayNumber)}
                role="tab"
                type="button"
              >
                <span className="text-[10px] font-black uppercase tracking-wide">
                  {DAY_NAMES[index]?.slice(0, 3)}
                </span>
                <span
                  className={cn(
                    "text-sm font-black",
                    !active && isToday && "text-kondo-green",
                  )}
                >
                  {date.getDate()}
                </span>
                {/* A real count, never a decorative dot. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1 w-1 rounded-full",
                    count
                      ? active
                        ? "bg-white"
                        : "bg-kondo-green"
                      : "bg-transparent",
                  )}
                />
                <span className="sr-only">
                  {count === 1 ? "1 class" : `${count} classes`}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={onPagerScroll}
          ref={dayPagerRef}
        >
          {dates.map((date, index) => {
            const dayNumber = index + 1;
            const dayCourses = coursesForDay(dayNumber);
            return (
              <section
                aria-label={DAY_NAMES[index]}
                className="w-full shrink-0 snap-center"
                key={date.toISOString()}
              >
                <div className="divide-y divide-border">
                  {dayCourses.map((course) => (
                    <div
                      className="flex items-stretch gap-3 px-4 py-4"
                      key={course.id}
                    >
                      {/* The period rail keeps the structure of the day
                          visible instead of flattening it into a list. */}
                      <div className="w-14 shrink-0 text-right">
                        <p className="text-sm font-black leading-tight">
                          {course.startTime ??
                            (course.startPeriod
                              ? `P${course.startPeriod}`
                              : "—")}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {course.endTime ??
                            (course.endPeriod ? `P${course.endPeriod}` : "TBC")}
                        </p>
                        {course.startPeriod ? (
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            Period {course.startPeriod}
                          </p>
                        ) : null}
                      </div>
                      <span
                        aria-hidden="true"
                        className="w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: course.color }}
                      />
                      <button
                        className="min-w-0 flex-1 rounded-2xl bg-muted/40 p-3 text-left transition active:scale-[0.99] motion-reduce:transform-none"
                        onClick={() => onEdit(course)}
                        type="button"
                      >
                        <p className="text-sm font-black leading-snug">
                          {course.courseName}
                        </p>
                        {course.room || course.teacher ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[course.room, course.teacher]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        ) : null}
                      </button>
                      <Button
                        aria-label={`Delete ${course.courseName}`}
                        className="self-center"
                        onClick={() => void onDelete(course.id)}
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                  {!dayCourses.length ? (
                    <p className="px-4 py-14 text-center text-sm text-muted-foreground">
                      No classes on {DAY_NAMES[index]}.
                    </p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <div className="hidden overflow-x-auto border-t border-border md:block">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[58px_repeat(7,minmax(92px,1fr))] border-b border-border bg-muted/25">
            <div />
            {dates.map((date, index) => {
              const active = date.toDateString() === todayKey;
              return (
                <div className="px-1 py-3 text-center" key={date.toISOString()}>
                  <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                    {DAY_NAMES[index]?.slice(0, 3)}
                  </p>
                  <span
                    className={`mt-1 inline-grid h-8 w-8 place-items-center rounded-full text-sm font-black ${
                      active
                        ? "bg-kondo-green text-white shadow-sm"
                        : "text-foreground"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-[58px_repeat(7,minmax(92px,1fr))]">
            <div className="relative h-[660px] border-r border-border">
              {hours.map((hour, index) => (
                <span
                  className="absolute right-2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground"
                  key={hour}
                  style={{ top: `${(index / 10) * 100}%` }}
                >
                  {String(hour).padStart(2, "0")}:00
                </span>
              ))}
            </div>
            {DAY_NAMES.map((day, index) => (
              <div
                className="relative h-[660px] border-r border-border last:border-r-0"
                key={day}
              >
                {hours.map((hour, hourIndex) => (
                  <span
                    className="absolute inset-x-0 border-t border-border/60"
                    key={hour}
                    style={{ top: `${(hourIndex / 10) * 100}%` }}
                  />
                ))}
                {courses
                  .filter((course) => course.dayOfWeek === index + 1)
                  .map((course) => {
                    const position = academicCalendarPosition(course);
                    const fallbackTop = Math.max(
                      0,
                      Math.min(90, ((course.startPeriod ?? 1) - 1) * 7.5),
                    );
                    return (
                      <div
                        className="group absolute inset-x-1 z-10 overflow-hidden rounded-xl border p-2 text-left shadow-sm transition hover:z-20 hover:-translate-y-0.5 hover:shadow-md"
                        key={course.id}
                        style={{
                          top: `${position?.top ?? fallbackTop}%`,
                          height: `${position?.height ?? 10}%`,
                          minHeight: "54px",
                          borderColor: course.color,
                          backgroundColor: `${course.color}1A`,
                        }}
                      >
                        <button
                          className="w-full text-left"
                          onClick={() => onEdit(course)}
                          type="button"
                        >
                          <p className="line-clamp-2 text-[11px] font-black leading-4">
                            {course.courseName}
                          </p>
                          <p className="mt-0.5 truncate text-[9px] font-bold text-muted-foreground">
                            {course.room || course.teacher || "Class"}
                          </p>
                        </button>
                        <button
                          aria-label={`Delete ${course.courseName}`}
                          className="absolute right-1 top-1 hidden rounded-full bg-card/90 p-1 text-red-600 shadow group-hover:block"
                          onClick={() => void onDelete(course.id)}
                          type="button"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 border-t border-border px-4 py-3">
            {[
              ...new Map(
                courses.map((course) => [
                  course.courseName,
                  { name: course.courseName, color: course.color },
                ]),
              ).values(),
            ]
              .slice(0, 8)
              .map((course) => (
                <span
                  className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground"
                  key={course.name}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: course.color }}
                  />
                  {course.name}
                </span>
              ))}
          </div>
        </div>
      </div>
    </>
  );
}

function ScheduleCourseList({
  courses,
  mode,
  onEdit,
  onDelete,
}: {
  courses: Course[];
  mode: "month" | "semester";
  onEdit: (course: Course) => void;
  onDelete: (courseId: string) => Promise<void>;
}) {
  return (
    <div className="min-h-[420px] border-t border-border p-4 sm:p-5">
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
          {mode === "month" ? "Recurring this month" : "Semester overview"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Courses remain grouped by weekday and use the same confirmed timetable
          data.
        </p>
      </div>
      <div className="space-y-5">
        {DAY_NAMES.map((day, index) => {
          const dayCourses = courses.filter(
            (course) => course.dayOfWeek === index + 1,
          );
          if (!dayCourses.length) return null;
          return (
            <section key={day}>
              <h3 className="mb-2 text-sm font-black">{day}</h3>
              <div className="space-y-2">
                {dayCourses.map((course) => (
                  <CourseRow
                    course={course}
                    key={course.id}
                    onDelete={() => void onDelete(course.id)}
                    onEdit={() => onEdit(course)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TaskMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "violet" | "blue";
}) {
  const toneClass = {
    emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  }[tone];
  return (
    <div className={`rounded-3xl p-4 sm:p-5 ${toneClass}`}>
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-wide">{label}</p>
    </div>
  );
}

function formatTaskDue(value: string) {
  const due = new Date(value);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
  const prefix = sameDay(due, today)
    ? "Today"
    : sameDay(due, tomorrow)
      ? "Tomorrow"
      : due.toLocaleDateString("en", { month: "short", day: "numeric" });
  return `${prefix}, ${due.toLocaleTimeString("en", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function TaskRow({
  task,
  disabled,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: AcademicTask;
  disabled: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const completed = task.status === "COMPLETED";
  return (
    <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
      <button
        aria-label={completed ? "Mark task pending" : "Complete task"}
        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${
          completed
            ? "border-kondo-green bg-kondo-green text-white"
            : "border-border hover:border-kondo-green"
        }`}
        disabled={disabled}
        onClick={onToggle}
        type="button"
      >
        {completed ? <Check className="h-3.5 w-3.5" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={`font-black ${
              completed ? "text-muted-foreground line-through" : ""
            }`}
          >
            {task.title}
          </p>
          <span className="rounded-full bg-muted px-2 py-1 text-[9px] font-black uppercase tracking-wide text-muted-foreground">
            {task.kind}
          </span>
          {task.priority === "HIGH" ? (
            <span className="rounded-full bg-red-500/10 px-2 py-1 text-[9px] font-black text-red-700 dark:text-red-300">
              HIGH
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {task.course?.courseName ?? "General"}
          {task.dueAt ? ` · ${formatTaskDue(task.dueAt)}` : " · No due date"}
        </p>
        {task.description ? (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {task.description}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          aria-label={`Edit ${task.title}`}
          disabled={disabled}
          onClick={onEdit}
          size="icon"
          variant="ghost"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          aria-label={`Delete ${task.title}`}
          disabled={disabled}
          onClick={onDelete}
          size="icon"
          variant="ghost"
        >
          <Trash2 className="h-4 w-4 text-red-600" />
        </Button>
      </div>
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
      <div>
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
    startTime: string | null;
    endTime: string | null;
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
        <span className="mb-1 block text-xs font-bold">Start period</span>
        <input
          className={input}
          max={40}
          min={1}
          onChange={(event) =>
            onChange(
              "startPeriod",
              (event.target.value ? Number(event.target.value) : null) as never,
            )
          }
          placeholder="e.g. 1"
          type="number"
          value={course.startPeriod ?? ""}
        />
      </label>
      <label>
        <span className="mb-1 block text-xs font-bold">End period</span>
        <input
          className={input}
          max={40}
          min={1}
          onChange={(event) =>
            onChange(
              "endPeriod",
              (event.target.value ? Number(event.target.value) : null) as never,
            )
          }
          placeholder="e.g. 2"
          type="number"
          value={course.endPeriod ?? ""}
        />
      </label>
      <label>
        <span className="mb-1 block text-xs font-bold">Start time</span>
        <input
          className={input}
          onChange={(event) =>
            onChange("startTime", event.target.value as never)
          }
          type="time"
          value={course.startTime ?? ""}
        />
      </label>
      <label>
        <span className="mb-1 block text-xs font-bold">End time</span>
        <input
          className={input}
          onChange={(event) => onChange("endTime", event.target.value as never)}
          type="time"
          value={course.endTime ?? ""}
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
          {DAY_NAMES[course.dayOfWeek - 1]} · {formatCourseTime(course)}{" "}
          {course.room ? `· ${course.room}` : ""}
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
