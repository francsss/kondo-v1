# Production launch checklist

## Source and release

- [ ] Local branch is `main`, working tree is clean, and local/remote HEAD match.
- [ ] Baseline and release commit hashes are recorded.
- [ ] `npm ci` completed with zero audit vulnerabilities.
- [ ] Format, lint, typecheck, Vitest, production build, Prisma generate and
      Prisma status all pass.
- [ ] `npm run release:audit -- --summary` reports zero issues.
- [ ] `npm run legacy:audit` reports read-only mode, zero writes and no source-
      key duplicates.
- [ ] Full Playwright suite passes against a production build.
- [ ] Final diff contains no `.env`, secret, local media or test credentials.

## Database and migrations

- [ ] Production and Preview use their intended Neon branches.
- [ ] `DATABASE_URL` is pooled; `DIRECT_URL` is the matching direct branch.
- [ ] Backup/PITR availability and restore ownership are confirmed.
- [ ] Every pending SQL migration has been manually reviewed.
- [ ] `prisma migrate deploy` is used; `prisma db push` is never used.
- [ ] No destructive seed flag is enabled.
- [ ] Rollback owner knows the previous compatible commit and compensating plan.

## Security and privacy

- [ ] Admin page/API permission audit is clean.
- [ ] Removed organization member is denied immediately.
- [ ] Suspended organization disappears from all public projections.
- [ ] Candidate list, documents, answers and reviewer notes are scoped.
- [ ] Reporter identity and exact Housing location require dedicated permission
      and emit AuditLog events.
- [ ] Private media download, malicious signature/PDF/SVG and ownership tests
      pass.
- [ ] Trusted-origin and rate-limit configuration is verified.
- [ ] Logs and analytics contain no secrets, private content or exact location.

## Providers

- [ ] R2, Resend, Upstash, LiveKit and DeepSeek credentials pass production
      environment validation when those production capabilities are required.
- [ ] PostHog, Web Push and Google Maps degrade safely when optional.
- [ ] Payment capability remains disabled unless a separately approved provider
      release exists.
- [ ] No unsupported provider, currency, country, university API, mobile-money
      network, quote or payment completion is displayed.

## Deployment and smoke tests

- [ ] GitHub `main` contains the release commit.
- [ ] Vercel deployment is Ready and references that exact commit.
- [ ] Build log confirms migration deploy, Prisma generate and Next build.
- [ ] Canonical `/` returns 200 over HTTPS.
- [ ] `/api/health` returns `{"status":"ok"}`.
- [ ] Public Organization, Housing, Opportunity, Product and Service unavailable
      states do not leak private data.
- [ ] Authenticated Home, Student Hub, Discover, Communities, Messages, Saved,
      Housing and Marketplace load.
- [ ] Organization owner and restricted-member flows are verified.
- [ ] Admin Reports, Housing, Opportunities, applications and catalog access
      match the permission matrix.
- [ ] Mobile, tablet, desktop, light/dark, keyboard, screen reader, reduced
      motion and slow-network states are accepted.

## Jiaxing pilot

- [ ] Jiaxing resolves by English/Chinese alias.
- [ ] Dynamic City Hub contains only real source records.
- [ ] Empty source sections are omitted.
- [ ] Exact Housing locations are absent.
- [ ] No fake provider, product, price, rating, opportunity or event exists.
- [ ] Editorial fallback is reviewed and can be removed without changing source
      modules. See `PART6_DISCOVER_CATALOG.md`.

## Rollback and incident response

- [ ] Redeploy the previous compatible commit first; additive schema remains.
- [ ] Do not reverse a migration by deleting production columns/tables during an
      incident.
- [ ] Disable optional provider/feature flags when the provider is the fault.
- [ ] Preserve AuditLog, report evidence and provider references.
- [ ] Rotate compromised secrets and revoke sessions where relevant.
- [ ] Run canonical and health smoke checks after rollback.

Final recommendation must remain **READY WITH CONDITIONS** while payment and
university billing are provider-disabled or any external production-only check
is incomplete.
