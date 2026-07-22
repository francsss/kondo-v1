# Student Hub architecture and operations

## Product structure

`/student-hub` has its own authenticated shell and exactly four primary areas:

1. **Guide** — existing published Kondo guides, saved state, search, categories, and checklists.
2. **My Tools** — private timetable import, review, manual course management, and today/week/semester views.
3. **Scholarships** — real database-backed opportunities with filters, saved items, and application status.
4. **Help** — existing community questions and answers, including recent, popular, unanswered, and personal views.

The shell deliberately links back to `/home`; it does not duplicate the main Kondo navigation.

## Timetable lifecycle

1. The signed-in student uploads one to five PDF/JPG/PNG/WebP files through the private media pipeline (`SCHEDULE_IMPORT`). Each file is signature checked, scanned for unsafe PDF actions, and stored privately in R2 in production.
2. The import API verifies ownership, active media status, the selected university/campus/term relationship, per-file limits, and a 30 MB aggregate limit.
3. The server-only `ScheduleAnalysisProvider` reads the private objects. It extracts embedded PDF text when available and otherwise runs bundled English/Chinese OCR for images and scanned PDFs. The browser never receives `DEEPSEEK_API_KEY`.
4. Only the extracted text is sent to the official DeepSeek Chat Completions API. `deepseek-v4-pro` returns JSON output, which is validated against the existing strict Zod schema. The workflow supports timetable notation such as `第1-2节`, `1-16周`, `单周`, and `双周`.
5. Official `UniversityPeriodConfiguration` records convert numbered periods into exact local times. Missing mappings are marked uncertain instead of invented.
6. The result enters `REVIEW_REQUIRED`. It is not a `StudentSchedule` yet. The student can edit, add, duplicate, or remove rows and must explicitly confirm.
7. Confirmation creates the schedule and courses atomically, snapshots the period mapping version, and writes an audit event. Source files are removed unless the student opted to retain them.

Analysis is on demand, not cron-based. The endpoint is rate limited to five analyses per student per 24 hours and retries one transient provider failure. Errors log provider/model/file count without file contents, extracted text, or API keys.

## University and period administration

Administrators with `STUDENT_HUB_CONFIG_VIEW` see `/admin/student-hub`. Administrators with `STUDENT_HUB_CONFIG_MANAGE` can add:

- campuses belonging to an existing verified university;
- academic terms with dates, first-week date, and week count;
- university-wide or campus-specific period configurations.

Only one default configuration is allowed for each university/campus scope. Updates create a new configuration version, and confirmed schedules retain a JSON snapshot so future university changes do not silently rewrite a student's timetable.

To add a university, first create/verify its country, city, and university in **Admin → Reference data**. Then open **Admin → Student Hub**, add campuses and the current semester, and create at least one active default period configuration. Verify the published times against the university's official timetable before enabling it.

Students can also submit a private custom mapping through `/api/student-hub/custom-period-configurations`; it is never promoted to an official configuration automatically.

## Environment variables

- `DEEPSEEK_API_KEY` — required in Vercel Production, server-only.
- `SCHEDULE_AI_PROVIDER` — optional; defaults to `deepseek`.
- `SCHEDULE_AI_MODEL` — optional; defaults to `deepseek-v4-pro`.
- `SCHEDULE_AI_TIMEOUT_MS` — optional 10–120 second timeout; default 120 seconds.
- The existing private R2 variables are required because timetable source files use the media pipeline.

To replace the AI provider, implement `ScheduleAnalysisProvider` in `src/lib/schedule-ai.ts`, preserve the strict `scheduleExtractionSchema`, return provider/model/token metadata, and add an explicit branch in `getScheduleAnalysisProvider`. Never call a provider from a client component.

## Release checklist

1. Apply Prisma migrations with `prisma migrate deploy` using the Neon direct URL.
2. Add the server-only AI variables to Vercel Production and redeploy.
3. In Admin, configure a test university, campus, semester, and default periods.
4. Import a known PDF and a mobile screenshot; verify Chinese text, period conversion, odd/even weeks, uncertainty flags, correction, and confirmation.
5. Refresh and sign back in; verify the schedule persists and is not visible to another account.
6. Add, edit, and delete a manual course; verify conflicts are warnings rather than destructive changes.
7. Confirm a non-retained source becomes inaccessible after save.
