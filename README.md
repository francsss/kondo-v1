# Kondo

Kondo is the digital home for African students studying in China. The MVP combines communities, a student-to-student marketplace, practical guides, community Q&A, global search, useful notifications, profiles, resumable onboarding, audited reference-data administration, and moderation operations. Kondo does not move money or process marketplace payments.

## Stack

- Next.js 16 App Router and React 19
- Strict TypeScript and Tailwind CSS
- shadcn-style composable UI primitives, Lucide icons, and Framer Motion-ready animation support
- Prisma ORM and PostgreSQL
- Database-backed sessions with signed, HTTP-only cookies
- Zod validation, permission-based Admin authorization, transactional audit logs, rate limits, and security headers
- Vitest unit tests plus disposable PostgreSQL integration and API E2E coverage
- Vercel on Node.js 24 LTS, Neon PostgreSQL, private Cloudflare R2, Upstash
  Redis, Resend, and GitHub-scheduled background workers

## Local development

Requires Node.js 24 and PostgreSQL.

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npx prisma migrate dev
KONDO_ALLOW_DESTRUCTIVE_SEED=true npm run db:seed
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Open [http://localhost:3000](http://localhost:3000) on the Mac or use the Mac's LAN address, for example `http://192.168.31.49:3000`, from a phone on the same Wi-Fi. Local HTTP sessions intentionally omit the cookie `Secure` flag; HTTPS deployments retain it.

The development config allows Next.js client/HMR resources from private `192.168.x.x` origins. Additional development host patterns can be supplied through the comma-separated `KONDO_DEV_ORIGINS` environment variable if the LAN uses another address range.

The demo seed deletes existing data. It runs only when `KONDO_ALLOW_DESTRUCTIVE_SEED=true` is supplied explicitly and always refuses `NODE_ENV=production` or `VERCEL_ENV=production`, even if the opt-in is present. Never configure this opt-in in Vercel production.

## Demo accounts

All seeded accounts use `ChangeMe123!`.

- `ama@example.com` — member experience
- `moderator@kondo.app` — moderation access
- `admin@kondo.app` — super-admin access

## Quality checks

`npm test` uses a separate PostgreSQL database. Local Docker Compose uses `kondo_module3_test`; CI should provide an isolated `TEST_DATABASE_URL`.

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
npm run e2e
```

Release operators should start with the
[Production Readiness Report](./docs/PRODUCTION_READINESS.md),
[Deployment Checklist](./docs/DEPLOYMENT_CHECKLIST.md), and
[Environment Variable Checklist](./docs/ENVIRONMENT_VARIABLES.md). Project
decisions and the complete change history live in [`docs`](./docs).
