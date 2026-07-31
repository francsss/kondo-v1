# Opportunities

Kondo Opportunities unifies scholarships, internships, jobs, research,
exchange programs and volunteering without rewriting the legacy Scholarship or
Scholarship Agent records. Legacy records remain read-only through the adapter.

## User journeys

- `/opportunities` provides instant search and data-backed filters.
- `/opportunities/[slug]` is the public, visibility-safe detail page.
- `/opportunities/[slug]/apply` is the seven-step Kondo application workflow.
- `/opportunities/applications` and `/opportunities/applications/[id]` keep the
  applicant's drafts, status history, interviews and offer actions private.
- `/opportunities/documents` is a private reusable document vault.
- `/opportunities/profile` and `/opportunities/preferences` store professional
  context and opt-in recommendation/reminder choices.

Organization publishers create and edit records from
`/organizations/[slug]/opportunities`. Application review is separately
permissioned: an `EDITOR` may author and submit opportunities but cannot access
applications, answers, documents or internal reviewer notes.

## Safety and privacy

Public reads must always use `opportunity-visibility.ts`. Publisher actions use
`opportunity-permissions.ts`; lifecycle and application transitions use their
central state machines. Application documents are private media and are served
only to their owner or an authorized reviewer of the application to which the
document is attached. Internal notes are never selected in applicant DTOs.

Funding, salary, popularity and urgency are never inferred. Missing values are
rendered as unspecified. External links accept only HTTP(S) URLs.

## Workers

Run `npm run opportunities:expire` and `npm run opportunities:reminders`, or
call the matching authenticated internal routes. Both accept `CRON_SECRET` or
`OPPORTUNITY_WORKER_SECRET`. The reminder worker sends only reminders users
explicitly selected and uses deterministic deduplication keys.
