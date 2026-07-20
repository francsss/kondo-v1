# Production deployment checklist

Complete the steps in order. Do not run the production seed.

## 1. Create and secure the services

- [ ] Neon: create an isolated production branch/database and role; enable the
      required backup or restore window.
- [ ] Cloudflare R2: create a private bucket, disable public `r2.dev` access,
      and create a bucket-scoped Object Read & Write S3 token.
- [ ] Cloudflare R2: apply the exact CORS policy in
      `docs/PRODUCTION_READINESS.md`, using the final canonical HTTPS origin.
- [ ] Upstash: create a production Redis database and copy its REST URL and
      read/write token.
- [ ] Resend: verify the sending domain and its DNS records, then create a
      sending API key.
- [ ] Vercel: import `francsss/kondo-v1`, use the repository root, and leave
      framework detection on Next.js.
- [ ] Vercel: confirm Node.js 24.x. `package.json` pins this supported LTS
      runtime.

## 2. Configure secrets and variables

- [ ] Generate independent `JWT_SECRET` and `CRON_SECRET` values.
- [ ] Add every mandatory Vercel value from
      `docs/ENVIRONMENT_VARIABLES.md` to the **Production** environment.
- [ ] Add GitHub Actions variable `PRODUCTION_APP_URL`.
- [ ] Add GitHub Actions secret `CRON_SECRET`, identical to Vercel's value.
- [ ] Keep production credentials out of Preview unless an isolated Preview
      service set has been created.
- [ ] Confirm `KONDO_ALLOW_DESTRUCTIVE_SEED` is absent or `false`.

## 3. Prepare the database

- [ ] From a trusted operator environment, back up or create a restore point.
- [ ] Set `DATABASE_URL` to Neon's pooled URL and `DIRECT_URL` to its matching
      direct URL.
- [ ] Run `npx prisma migrate status`.
- [ ] Run `npx prisma migrate deploy`.
- [ ] Run `npx prisma migrate status` again and confirm all 21 migrations are
      applied.
- [ ] Register and verify the intended initial administrator, then run
      `npm run admin:bootstrap -- admin@your-domain.com --confirm` with the
      production database URLs from a trusted operator environment. This
      audited command works only when no active Super Admin exists.
- [ ] Never load demo seed accounts into production.

## 4. Deploy the reviewed commit

- [ ] Confirm GitHub Release checks are green for the exact commit.
- [ ] Trigger a Vercel production deployment from `main`.
- [ ] Confirm the build selects Node.js 24 and production environment
      validation succeeds.
- [ ] Confirm `GET /api/health` returns HTTP 200 and `{"status":"ok"}`.
- [ ] Confirm the GitHub Production workers workflow can be dispatched
      manually and all four jobs succeed.

## 5. Production smoke test

- [ ] Register, verify email, sign in, sign out, reset password, and revoke a
      session.
- [ ] Finish onboarding and verify Home, Search, Student Hub, Guides, Help,
      Explore Jiaxing/City Hub, Profiles, Settings, and Notifications.
- [ ] Upload and render a Home post image.
- [ ] Upload and render a community post image and community cover.
- [ ] Create, edit, publish, favorite, contact, and close a Marketplace listing
      with images.
- [ ] Replace and remove a profile avatar.
- [ ] Send and receive a message image and constrained PDF; confirm only
      participants can download private attachments.
- [ ] Exercise Admin overview, reports, users, communities, marketplace,
      media, guides, City Hubs, reference data, notifications, message safety,
      and audit log.
- [ ] Confirm email verification, password reset, and digest messages arrive
      from the verified sender.
- [ ] Confirm rate-limit keys appear in Upstash and abusive requests receive
      HTTP 429.
- [ ] Confirm expired listings and orphaned media are processed by scheduled
      workers.

## 6. Upload-specific verification

- [ ] In browser developer tools, confirm `POST /api/media/uploads` returns 201.
- [ ] Confirm the direct R2 `PUT` completes without a CORS or checksum error.
- [ ] Confirm upload completion returns 200 and detects the real MIME type.
- [ ] Confirm attached images render through `/api/media/:id` and its
      short-lived signed R2 redirect.
- [ ] Confirm an unauthorized account receives the same 404 as a missing
      private object.
- [ ] Confirm invalid magic bytes, oversized files, unsafe PDFs, and mismatched
      MIME types are rejected and never become deliverable.

## 7. Observe and retain rollback capability

- [ ] Review Vercel function/build logs, Neon metrics, R2 operations, Upstash
      usage, Resend delivery events, and GitHub worker history.
- [ ] Configure uptime monitoring for `/api/health` and alerting for Vercel,
      scheduled-worker, database, and email failures.
- [ ] Record the production commit SHA and previous healthy Vercel deployment.
- [ ] If a release fails, roll Vercel back to the previous healthy deployment.
      Do not reverse an applied database migration; deploy a reviewed forward
      migration instead.
