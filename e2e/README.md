# End-to-end tests (Playwright)

These tests drive a real, running Kondo instance in a browser. They are
separate from `tests/` (Vitest unit/integration tests, run with `npm test`)
and are never picked up by Vitest.

## Running locally

1. A PostgreSQL database seeded with the demo dataset:
   ```
   DATABASE_URL="postgresql://kondo:kondo_password@localhost:5432/kondo?schema=public" \
   KONDO_ALLOW_DESTRUCTIVE_SEED=true npx tsx prisma/seed.ts
   ```
   The demo login (`ama@example.com` / `ChangeMe123!`) is what
   `e2e/auth.setup.ts` and `e2e/sign-out.guest.spec.ts` sign in with.
2. Run the suite, passing the same env vars `next build`/`next start` need:
   ```
   DATABASE_URL="postgresql://kondo:kondo_password@localhost:5432/kondo?schema=public" \
   JWT_SECRET="a-long-random-secret-at-least-32-characters" \
   NEXT_PUBLIC_APP_URL="http://localhost:3100" \
   NOTIFICATION_WORKER_SECRET="a-separate-long-random-secret" \
   npm run e2e
   ```

`playwright.config.ts` builds a production server (`next build && next start`)
and points the browser at it rather than `next dev`: Fast Refresh/HMR churn
under several parallel Playwright workers causes full reloads mid-test and
flaky hydration races, so a built server is both faster to run repeatedly
(`reuseExistingServer` outside CI) and far more stable.

Set `PLAYWRIGHT_SKIP_WEB_SERVER=1` to point the suite at a server you're
already running yourself (`PLAYWRIGHT_BASE_URL` to target a non-default URL).

## Structure

- `*.guest.spec.ts` — runs unauthenticated, no shared session.
- `*.authenticated.spec.ts` — runs with the storage state `auth.setup.ts`
  saves after logging in once; all tests in this project share one session.
  Never log out inside one of these — it revokes the session server-side and
  breaks every other test running in parallel against the same storage
  state. `sign-out.guest.spec.ts` covers logout with its own independent
  login instead.

## Adding a critical journey

Prefer `getByRole`/`getByPlaceholder`/`getByText` over CSS selectors, and
avoid `exact: true` on any nav link that can carry an unread-count badge
(Messages, Notifications) — the badge text is folded into the accessible
name.

## The reader suite and its books

`books-reader.authenticated.spec.ts` reads two EPUBs, because the defects it
guards divide in two.

Most of them are true of any EPUB — the hub's navigation sitting over the
reader's controls, a selection toolbar wider than the phone, progress erased on
reopen, `?at=` not opening at the passage that was tapped. Those run against a
fixture `books.setup.ts` builds and imports for you, so they are covered on
every run and need nothing set up by hand.

The rest need the specific file that exposed them: Project Gutenberg's *Alice's
Adventures in Wonderland*, which opens on an SVG-only cover page, links its own
stylesheets, and writes every table-of-contents entry as
`document.xhtml#anchor`. Books are not stored in git, so that file is not here,
and those checks **skip with a reason** rather than pass emptily. To run them,
obtain the EPUB from a legitimate source and import it:

```
npm run books:import -- ./alice.epub --slug alice-in-wonderland \
  --title "Alice's Adventures in Wonderland" --author "Lewis Carroll" \
  --ai-allowed --publish
```

The cover check additionally skips for a member who has already started the
book — it resumes where they were, which is correct, and there is no cover on
screen to measure. Clear `StudyReadingProgress` to run it again.
