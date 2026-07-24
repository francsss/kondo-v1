# Kondo product analytics

Kondo uses PostHog for behavioral product analytics and keeps the existing
`AnalyticsEvent` table for small, operationally useful server metrics. Product
analytics must never block a user action.

## Runtime configuration

Set these in local development and Vercel:

- `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`: PostHog project token.
- `NEXT_PUBLIC_POSTHOG_HOST`: ingestion host, normally
  `https://us.i.posthog.com` or `https://eu.i.posthog.com`.

Client capture is a no-op when the project token is absent. Autocapture and
session replay are deliberately disabled. Kondo emits named, decision-oriented
events only.

To provision the reviewed dashboards, also set these locally for the one-time
setup command:

- `POSTHOG_PERSONAL_API_KEY`: a personal API key with insight and dashboard
  write access. Never expose this key to the browser or Vercel client bundle.
- `POSTHOG_PROJECT_ID`: the numeric PostHog project ID.
- `POSTHOG_API_HOST`: optional management API host, for example
  `https://us.posthog.com`.

Run `npm run posthog:setup`. The script is idempotent by dashboard and insight
name. It creates:

- **Kondo · Activation & retention**: registration/onboarding funnel,
  abandonment, conversion time, and D1/D7/D30 retention.
- **Kondo · Product usage & reliability**: DAU/WAU/MAU, top features, average
  time, city/university distribution, timetable import health, and actionable
  errors.

## Event policy

Events and their names live in
`src/lib/product-analytics-events.ts`. Add a new event only when its result can
change a product, support, growth, or reliability decision.

Allowed properties are bounded identifiers and classifications such as role,
city slug, university slug, feature, outcome, status code, duration, file MIME
category, count, and retry state.

Never capture:

- e-mail addresses, phone numbers, passwords, tokens, or IP addresses;
- message, comment, post, search, or form content;
- file names, notification text, scholarship application data, or URLs with
  query strings;
- raw user-agent strings or full error messages/stacks.

Dynamic identifiers in routes are normalized before capture. Identified users
use the internal Kondo user ID as their PostHog distinct ID. Public profile
properties are limited to product segmentation traits: role, country, city,
university, and onboarding completion.

## Funnel semantics

- `landing_viewed`, `join_clicked`, `registration_started`,
  `registration_completed`, `onboarding_started`, `onboarding_completed`, and
  `home_arrived_after_onboarding` form the primary activation funnel.
- `registration_validation_error` and `onboarding_validation_error` contain an
  error class/status, never the submitted value.
- `onboarding_step_reached` and `onboarding_step_completed` contain the stable
  step key, step number, and completion duration.

## Reliability semantics

The client records only degraded cases:

- same-origin APIs slower than two seconds;
- non-success API responses and network failures;
- upload/import failures;
- JavaScript errors by error class and source file only;
- Web Vitals beyond the standard “good” thresholds.

Successful normal API calls are not captured, keeping volume and cost bounded.
The presence heartbeat endpoint is excluded from performance analytics.
