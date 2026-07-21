# Kondo Development Changelog

This file is append-only. Each version records completed work and migration guidance.

# Version 0.1.0

Date:
2026-07-05

## Summary

Initial repository baseline: a Next.js 14 demonstration for Cameroon-to-China transfer operations. This entry reconstructs the pre-pivot state so the project history begins before the community-platform migration.

## Features Added

- Email/password authentication and three transfer-era roles.
- Transfer quote, creation, tracking, manual payout administration, settings, and audit flows.
- PostgreSQL/Prisma foundation and unit tests for quote, status, provider, and authorization behavior.

## Features Modified

- None; initial baseline.

## Bugs Fixed

- None recorded.

## Database Changes

- Added users, transfers, recipients, application settings, and audit logs.
- Added transfer status, payment method, and provider status enums.
- Added transfer and audit indexes.
- Used schema synchronization without a committed migration.

## API Changes

- Added authentication, quote preview, sender transfer, and admin transfer endpoints.

## UI/UX Changes

- Added transfer landing, authentication, sender dashboard, transfer flow, and operations administration.

## Performance Improvements

- Used App Router and server-rendered authenticated pages.

## Security Improvements

- Added password hashing, signed cookies, role checks, validation, and audit records.

## Files Created

- Initial `app`, `src`, `prisma`, `tests`, configuration, and product-spec files.

## Files Modified

- None; initial baseline.

## Files Removed

- None.

## Breaking Changes

None; initial version.

## Migration Notes

This historical version is superseded by 0.2.0 and must not be deployed. Its product model conflicts with the current Kondo vision.

## Next Recommended Tasks

- Replace the transfer product with the African-student community platform defined by the current product vision.

⸻

# Version 0.2.0

Date:
2026-07-14

## Summary

Completed Kondo’s foundational product pivot from a money-transfer prototype to a premium, responsive community platform for African students studying in China. The release replaces the domain model, application navigation, primary user journeys, security/session foundation, seeded content, operational dashboard, and all project documentation.

## Features Added

- Premium public landing experience with a product-specific application preview and trust narrative.
- Secure registration/login, revocable database sessions, OAuth-ready account model, and four-step onboarding.
- Personalized home feed with checklist progress, posts, events, local context, communities, and marketplace discovery.
- Community directory and detail surfaces for university, country, city, and topic groups.
- End-to-end community join/leave and post-creation flows with optimistic state and ownership protection.
- Posts, threaded comments, reactions, events, announcements, pinned content, membership roles, and moderation states.
- Student marketplace with categories, listings, portable image keys, favorites, city context, seller identity, filters, and contact handoff.
- Interactive guide library with ordered checklist steps, optimistic progress updates, bookmarks foundation, and editorial metadata.
- Persisted cross-feature bookmarks, a saved-guide library view, and bulk notification read state.
- Community help center with categories, questions, answers, best-answer selection, and helpful votes.
- End-to-end question, answer, and helpful-vote flows.
- One global search across communities, listings, guides, questions, users, and posts.
- Useful notifications, student profiles, light/dark modes, responsive mobile navigation, and reduced-motion support.
- Role-gated admin overview for users, community health, marketplace, guides, moderation, audit readiness, and WAU-centered analytics.
- Rate-limit, request-origin, input-validation, analytics, audit, and report foundations.
- Public about, community-guideline, privacy-overview, and draft-terms pages so trust links never dead-end.

## Features Modified

- Upgraded Next.js from 14.2 to 16.2 and React from 18.3 to 19.2.
- Upgraded Vitest from 2.1 to 4.1 and moved its configuration to ESM.
- Replaced transfer-era roles with `MEMBER`, `MODERATOR`, `ADMIN`, and `SUPER_ADMIN`.
- Rebuilt the visual system around forest, emerald, lime, sand, spacious cards, and accessible dark mode.
- Rebuilt authentication from a stateless signed-cookie check to a signed cookie plus hashed, revocable database session.
- Updated package scripts with lint, formatting, schema generation, migration, and full verification commands.
- Redirected the legacy `/dashboard` path to `/home`.

## Bugs Fixed

- Removed the stale `.next` type-generation failure that affected standalone type checks.
- Removed transfer-domain compile dependencies and conflicting legacy documentation.
- Added an explicit Turbopack project root to avoid incorrect workspace-root inference.
- Aligned ESLint with the Next.js-supported major version.

## Database Changes

- Removed transfer, recipient, application-setting, payment-method, payment-provider, and transfer-status models/enums.
- Added normalized country, city, university, community, membership, post, comment, reaction, marketplace, guide, help-center, bookmark, notification, report, analytics, OAuth, and session models.
- Added compound uniqueness rules and indexes for the primary feed, search, moderation, notification, marketplace, and analytics query shapes.
- Added portable object-storage keys for avatars, community covers, guide covers, and listing images.
- Added Prisma migration `20260715060000_kondo_community_mvp`.
- Replaced the transfer seed with deterministic community-platform demo content.

## API Changes

- Added `PUT /api/onboarding`.
- Added `GET /api/communities`.
- Added `POST|DELETE /api/communities/:id/members`.
- Added `POST /api/posts`.
- Added `POST|DELETE /api/posts/:id/reactions`.
- Added `GET|POST /api/marketplace`.
- Added `POST|DELETE /api/marketplace/:id/favorites`.
- Added `PUT|DELETE /api/guides/progress/:stepId`.
- Added `GET|PUT|DELETE /api/bookmarks/:targetType/:targetId`.
- Added `PATCH /api/notifications/read-all`.
- Added `GET /api/search`.
- Added `POST /api/questions`.
- Added `POST /api/questions/:id/answers`.
- Added `PUT|DELETE /api/answers/:id/votes`.
- Updated register, login, logout, and current-user endpoints for new roles and database sessions.
- Removed all quote, transfer, payout, payment-provider, and transfer-administration endpoints.

## UI/UX Changes

- Added landing, home, onboarding, communities, community detail, marketplace, listing detail, guides, guide detail, help center, question detail, notifications, search, profile, and admin experiences.
- Added responsive desktop sidebar, mobile drawer, mobile bottom navigation, sticky global search, and system-aware theme toggle.
- Added optimistic reaction, favorite, and guide-progress interactions with rollback behavior where persisted.
- Added persisted post/guide bookmark controls, saved-guide filtering, copied-link sharing, and functional bulk notification read state.
- Disabled future admin, profile, media-upload, and private-message controls with explicit roadmap context instead of presenting dead actions.
- Added accessible post/question dialogs and inline answer creation.
- Added subtle Framer Motion route transitions that honor reduced-motion preferences.
- Added product-specific empty states, trust copy, progress indicators, hover states, and mobile layouts.
- Removed transfer landing, sender dashboard, quote form, payout timeline, transfer details, and transfer administration.

## Performance Improvements

- Upgraded to the current stable App Router release line.
- Kept read-heavy authenticated views in Server Components and limited Client Components to interaction boundaries.
- Memoized the current-user read per request to avoid duplicate layout/page session queries.
- Added AVIF/WebP image configuration, response compression, short public endpoint caches, and production build scripts.
- Kept initial page architecture code-split by route and feature.

## Security Improvements

- Added hashed database-backed session revocation and expiry checks.
- Added same-origin checks for state-changing route handlers.
- Added publishable-target verification for polymorphic bookmark mutations.
- Added auth, search, post, and listing rate limits.
- Added stronger password rules and generic authentication errors.
- Added CSP, frame denial, MIME sniff prevention, referrer, DNS prefetch, and permissions-policy headers.
- Added moderation reports, constrained roles, content states, and audit-ready operations.
- Added npm dependency auditing and documented the residual moderate advisory in the stable Next.js dependency tree.
- Removed the vulnerable legacy Vite/esbuild development-tool chain by upgrading Vitest.

## Files Created

- `app/(platform)/layout.tsx`
- `app/(platform)/home/page.tsx`
- `app/(platform)/communities/page.tsx`
- `app/(platform)/communities/[slug]/page.tsx`
- `app/(platform)/marketplace/page.tsx`
- `app/(platform)/marketplace/[slug]/page.tsx`
- `app/(platform)/guides/page.tsx`
- `app/(platform)/guides/[slug]/page.tsx`
- `app/(platform)/help/page.tsx`
- `app/(platform)/help/[slug]/page.tsx`
- `app/(platform)/notifications/page.tsx`
- `app/(platform)/profile/page.tsx`
- `app/(platform)/profile/[username]/page.tsx`
- `app/(platform)/search/page.tsx`
- `app/onboarding/page.tsx`
- `app/about/page.tsx`
- `app/guidelines/page.tsx`
- `app/privacy/page.tsx`
- `app/terms/page.tsx`
- `app/api/onboarding/route.ts`
- `app/api/communities/route.ts`
- `app/api/communities/[id]/members/route.ts`
- `app/api/posts/route.ts`
- `app/api/posts/[id]/reactions/route.ts`
- `app/api/marketplace/route.ts`
- `app/api/marketplace/[id]/favorites/route.ts`
- `app/api/guides/progress/[stepId]/route.ts`
- `app/api/bookmarks/[targetType]/[targetId]/route.ts`
- `app/api/notifications/read-all/route.ts`
- `app/api/search/route.ts`
- `app/api/questions/route.ts`
- `app/api/questions/[id]/answers/route.ts`
- `app/api/answers/[id]/votes/route.ts`
- `src/components/app/AppShell.tsx`
- `src/components/features/community/CommunityCard.tsx`
- `src/components/features/community/CommunityJoinButton.tsx`
- `src/components/features/community/PostComposer.tsx`
- `src/components/features/community/FeedPost.tsx`
- `src/components/features/bookmarks/BookmarkButton.tsx`
- `src/components/features/marketplace/ListingCard.tsx`
- `src/components/features/marketplace/ListingFavoriteButton.tsx`
- `src/components/features/guides/GuideCard.tsx`
- `src/components/features/guides/GuideChecklist.tsx`
- `src/components/features/help/QuestionComposer.tsx`
- `src/components/features/help/AnswerComposer.tsx`
- `src/components/features/help/HelpfulButton.tsx`
- `src/components/features/notifications/MarkAllReadButton.tsx`
- `src/components/onboarding/OnboardingFlow.tsx`
- `src/components/providers/ThemeProvider.tsx`
- `src/components/marketing/InfoPage.tsx`
- `src/components/ui/Avatar.tsx`
- `src/components/ui/PageHeader.tsx`
- `src/lib/platform-queries.ts`
- `src/lib/presentation.ts`
- `src/lib/rate-limit.ts`
- `src/lib/utils.ts`
- `tests/unit/validation.test.ts`
- `eslint.config.mjs`
- `.prettierignore`
- `vitest.config.mts`
- `prisma/migrations/20260715060000_kondo_community_mvp/migration.sql`
- `public/og.png`
- `docs/CHANGELOG.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/API.md`
- `docs/COMPONENTS.md`
- `docs/SECURITY.md`
- `docs/DEPLOYMENT.md`
- `docs/ROADMAP.md`

## Files Modified

- `package.json`
- `package-lock.json`
- `.env.example`
- `next.config.mjs`
- `docker-compose.yml`
- `tailwind.config.ts`
- `tsconfig.json`
- `app/layout.tsx`
- `app/globals.css`
- `app/page.tsx`
- `app/login/page.tsx`
- `app/register/page.tsx`
- `app/dashboard/page.tsx`
- `app/admin/layout.tsx`
- `app/admin/page.tsx`
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/me/route.ts`
- `app/api/auth/register/route.ts`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/components/KondoLogo.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/Card.tsx`
- `src/lib/auth.ts`
- `src/lib/authorization.ts`
- `src/lib/request.ts`
- `src/lib/serializers.ts`
- `src/lib/server-auth.ts`
- `src/lib/validation.ts`
- `tests/unit/authorization.test.ts`
- `README.md`

## Files Removed

- `app/transfers/new/page.tsx`
- `app/transfers/[id]/page.tsx`
- `app/admin/audit/page.tsx`
- `app/admin/operations/page.tsx`
- `app/admin/settings/page.tsx`
- `app/admin/transfers/page.tsx`
- `app/admin/transfers/[id]/page.tsx`
- `app/api/quotes/preview/route.ts`
- `app/api/transfers/route.ts`
- `app/api/transfers/[id]/route.ts`
- `app/api/transfers/[id]/cancel/route.ts`
- All transfer-administration API routes under `app/api/admin/transfers`.
- `app/api/admin/audit/route.ts`
- `app/api/admin/settings/route.ts`
- `src/components/Navbar.tsx`
- All transfer-specific components under `src/components/transfer`.
- All transfer-era admin components under `src/components/admin`.
- `src/config/rate-tiers.ts`
- `src/lib/money.ts`
- All payment-provider files under `src/lib/payments`.
- `src/lib/reference.ts`
- `src/lib/settings.ts`
- `src/lib/status.ts`
- `src/types/api.ts`
- Transfer quote, provider, and status unit tests.
- `vitest.config.ts` (replaced by the ESM `.mts` configuration).
- `docs/KONDO_V1_PRODUCT_SPEC.md`
- `docs/API_INTEGRATION_TODO.md`
- Transfer-specific `src/components/ui/Badge.tsx`.
- Unused transfer-era form, feedback, dialog, empty-state, loader, select, stat-card, and formatting helpers.
- `public/kondo-logo.png`, which contained the retired transfer tagline.

## Breaking Changes

This is a complete domain break. Transfer-era routes, APIs, roles, tables, statuses, seed accounts, and operational workflows no longer exist. The new migration is intended for a fresh MVP database; do not apply it over transfer-era production data without a reviewed archival/export plan.

## Migration Notes

- Use Node.js 20.9 or newer.
- Replace local environment values from the updated `.env.example`.
- Provision a fresh PostgreSQL database, run `npm run db:generate`, then `npx prisma migrate deploy`.
- Run `npm run db:seed` only in local/demo environments.
- Demo sign-in is now `ama@example.com`, `moderator@kondo.app`, or `admin@kondo.app` with `ChangeMe123!`.
- Configure a strong `JWT_SECRET`; existing transfer-era cookies are intentionally invalid.
- Object-storage variables are documented but signed upload delivery remains a launch-gate task.

## Next Recommended Tasks

- Complete CRUD interfaces and APIs for the core engagement loops.
- Add signed image uploads and server-side media validation.
- Add email verification, password reset, and shared Redis rate limiting.
- Add cursor pagination, full-text search indexes, and end-to-end authorization tests.
- Complete admin moderation actions and production observability.

⸻

# Version 0.2.1

Date:
2026-07-15

## Summary

Corrected session-cookie transport and Next.js development-origin handling so authentication works from both `localhost` and phones using the Mac's private HTTP address, while retaining secure HTTPS cookies on Vercel.

## Features Added

- Added regression coverage for cookie creation, HTTPS transport, HTTP LAN transport, deletion scope, database-session creation, and the login response `Set-Cookie` header.

## Features Modified

- Made session-cookie security request-aware instead of relying on `NODE_ENV` alone.
- Allowed Next.js development client/HMR resources from private `192.168.x.x` origins, with optional extra patterns through `KONDO_DEV_ORIGINS`.
- Made login and registration fetches explicitly include credentials.
- Changed successful authentication navigation to replace the login/register history entry.

## Bugs Fixed

- Fixed immediate redirects back to `/login` on phones because browsers rejected a `Secure` cookie delivered over a private HTTP IP address.
- Fixed Next.js 16 blocking the client and HMR resources needed to hydrate authentication forms opened from the Mac's LAN address.
- Fixed cookie deletion so it explicitly expires the same host-only cookie with matching scope and transport options.

## Database Changes

- No schema or migration changes.
- Login continues to create a hashed, revocable row in the existing `Session` table.

## API Changes

- Updated login and registration responses to choose the cookie `Secure` flag from production mode plus the effective request protocol.
- Updated logout to clear the cookie with the same request-aware policy.
- No endpoints were added, updated, or removed at the contract level.

## UI/UX Changes

- Successful login and registration now use history replacement before refreshing authenticated Server Components.
- No page or component layout changes.
- Authentication forms now declare POST fallbacks so unavailable hydration cannot place passwords in URL query parameters.

## Performance Improvements

- No material performance changes.

## Security Improvements

- Retained `Secure` for production HTTPS and Vercel-forwarded HTTPS traffic.
- Retained host-only, HTTP-only, `SameSite=Lax`, and `Path=/` cookie protections across creation and deletion.
- Added tests proving that local IP HTTP does not receive an unusable `Secure` attribute.
- Limited LAN client-resource access to development-only private origin patterns.

## Files Created

- `tests/unit/auth-cookie.test.ts`
- `tests/unit/login-route.test.ts`

## Files Modified

- `src/lib/auth.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/register/route.ts`
- `app/api/auth/logout/route.ts`
- `app/login/page.tsx`
- `app/register/page.tsx`
- `next.config.mjs`
- `package.json`
- `package-lock.json`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/SECURITY.md`
- `docs/DEPLOYMENT.md`
- `docs/CHANGELOG.md`

## Files Removed

- None.

## Breaking Changes

None. Existing users may need to sign in once again if their browser previously rejected or retained an incompatible local cookie.

## Migration Notes

- No database migration is required.
- Restart the Next.js server so the new cookie policy is active.
- Vercel requires no cookie-specific environment variable; `NEXT_PUBLIC_APP_URL` remains metadata-only.

## Next Recommended Tasks

- Add browser-level authentication tests against both an HTTP LAN origin and a deployed HTTPS preview.
- Add session/device management and individual session revocation UI.

⸻

# Version 0.3.0

Date:
2026-07-15

## Summary

Added the competition-ready Explore Jiaxing experience as a self-contained extension of Kondo. The feature promotes Jiaxing's companies, products, universities, opportunities, events, services, and international identity through reusable city-hub architecture while preserving every existing module and the current bottom navigation.

## Features Added

- Added an accessible premium top-right menu with Explore Jiaxing, City Events, Settings, and Language destinations.
- Added a modern Explore Jiaxing city hub with seven dedicated sections: Local Companies, Local Products, Universities, Jobs & Internships, Local Events, City Services, and About Jiaxing.
- Added reusable dynamic routes for city hubs and city sections.
- Added a typed city registry and domain contracts designed to support Shanghai, Hangzhou, Beijing, or a profile-selected city without duplicating page architecture.
- Added source-aware editorial cards and explicit verification states for opportunities and dated events.
- Added lightweight Settings and Language surfaces so every new menu destination resolves to a useful page.
- Added registry unit tests covering city resolution, section coverage, route parameters, and unique identifiers.

## Features Modified

- Extended the authenticated application shell with the new top-right utility menu.
- Updated the package version from 0.2.1 to 0.3.0.
- Updated the architecture, component inventory, and roadmap to reflect the city-exploration boundary and future editorial workflow.

## Bugs Fixed

- None. This release is an additive feature extension.

## Database Changes

- No new tables.
- No schema changes.
- No new indexes.
- No Prisma migrations.
- City content currently uses typed local editorial records behind a registry boundary that is ready for a future database or CMS adapter.

## API Changes

- No new endpoints.
- No updated endpoints.
- No removed endpoints.

## UI/UX Changes

- Added a premium dropdown in the existing top-right header action area.
- Added responsive city-guide and section pages using the existing Kondo design tokens, typography, dark mode, spacing, and component conventions.
- Added modern editorial cards, city signals, horizontal section navigation, responsive grids, and restrained CSS-native visual treatments.
- Kept the existing desktop sidebar, mobile drawer, and five-item mobile bottom navigation unchanged.

## Performance Improvements

- Rendered all Explore content with Server Components and static route parameters.
- Limited client-side state to the compact dropdown menu.
- Used CSS-native visual treatments and local typed data, adding no image payload or runtime data request.

## Security Improvements

- Opened official external sources with `noopener noreferrer` protections.
- Labeled unverified jobs and date-sensitive events instead of presenting editorial examples as active offers.
- Added no mutation endpoint, credential flow, or new client-side trust boundary.

## Files Created

- `src/features/explore/types.ts`
- `src/features/explore/registry.ts`
- `src/features/explore/cities/jiaxing.ts`
- `src/components/features/explore/ExploreIcon.tsx`
- `src/components/features/explore/ExploreMenu.tsx`
- `src/components/features/explore/CityHubView.tsx`
- `src/components/features/explore/CitySectionView.tsx`
- `app/(platform)/explore/[city]/page.tsx`
- `app/(platform)/explore/[city]/[section]/page.tsx`
- `app/(platform)/settings/page.tsx`
- `app/(platform)/language/page.tsx`
- `tests/unit/explore-registry.test.ts`

## Files Modified

- `src/components/app/AppShell.tsx`
- `package.json`
- `package-lock.json`
- `docs/ARCHITECTURE.md`
- `docs/COMPONENTS.md`
- `docs/ROADMAP.md`
- `docs/CHANGELOG.md`

## Files Removed

- None.

## Breaking Changes

None. Existing routes, modules, APIs, database schema, desktop navigation, and mobile bottom navigation are unchanged.

## Migration Notes

- No dependency installation or database migration is required.
- Restart the development server to load the new routes.
- The Jiaxing editorial dataset is intentionally separate from live jobs and events; partner verification and date lifecycle must be implemented before publishing time-sensitive records as active opportunities.

## Next Recommended Tasks

- Add a reviewed CMS or database adapter for city content while preserving the registry contract.
- Add partner submission, verification, expiry, and moderation workflows for jobs, internships, and events.
- Select a default city from the user's profile and add an explicit city switcher.
- Register the next city hub using the same city data contract.

⸻

# Version 0.3.1

Date:
2026-07-15

## Summary

Improved the visibility and mobile reliability of the Explore Jiaxing menu trigger after confirming that the active development server already contained the 0.3.0 feature but exposed it through an overly subtle icon-only action.

## Features Added

- None.

## Features Modified

- Changed the Explore trigger to a high-contrast Kondo action with a visible `Explore` label on tablet and desktop widths.
- Kept a compact ⋮ menu trigger on phones while making its surface visually prominent.
- Updated the package version from 0.3.0 to 0.3.1.

## Bugs Fixed

- Prevented the right-side header actions, including Explore, from being pushed off-screen by the search field on narrow phone viewports.
- Added explicit shrinking constraints to the header search and a stable non-shrinking action group.

## Database Changes

- No new tables.
- No schema changes.
- No new indexes.
- No Prisma migrations.

## API Changes

- No new endpoints.
- No updated endpoints.
- No removed endpoints.

## UI/UX Changes

- Made Explore Jiaxing immediately discoverable in the existing top-right header area.
- Preserved the current desktop sidebar, mobile drawer, and five-item mobile bottom navigation without changes.
- Preserved the existing premium dropdown and all four destinations.

## Performance Improvements

- No material performance changes.

## Security Improvements

- No security behavior changes.

## Files Created

- None.

## Files Modified

- `src/components/features/explore/ExploreMenu.tsx`
- `src/components/app/AppShell.tsx`
- `package.json`
- `package-lock.json`
- `docs/COMPONENTS.md`
- `docs/CHANGELOG.md`

## Files Removed

- None.

## Breaking Changes

None. Routes, authentication, APIs, database schema, and navigation destinations are unchanged.

## Migration Notes

- No dependency installation or database migration is required.
- Restart the development server or refresh the page after the development server recompiles.
- The Explore menu is available inside the authenticated application shell; the direct route is `/explore/jiaxing`.

## Next Recommended Tasks

- Add browser-level viewport regression coverage for the authenticated header when an automated browser environment is available.
- Continue with the reviewed city-content workflow already listed in the roadmap.

⸻

# Version 0.3.2

Date:
2026-07-15

## Summary

Simplified the authenticated application header to a greeting and one menu button, and moved the existing theme control to Settings → Appearance. This release is limited to the requested UI refinement.

## Features Added

- None. Existing theme behavior was relocated rather than expanded.

## Features Modified

- Moved theme selection from the header to a dedicated Appearance settings page.
- Exposed the existing Light, Dark, and system-following modes through the current `next-themes` provider.
- Consolidated Search, Notifications, Profile, Explore Jiaxing, City Events, Settings, and Language access into the existing desktop menu and mobile drawer after removing their standalone header controls.
- Updated the package version from 0.3.1 to 0.3.2.

## Bugs Fixed

- None.

## Database Changes

- No new tables.
- No schema changes.
- No new indexes.
- No Prisma migrations.

## API Changes

- No new endpoints.
- No updated endpoints.
- No removed endpoints.

## UI/UX Changes

- Removed the Light/Dark toggle, search field, notification button, and profile avatar from the visible header.
- Reduced the header to a user greeting and one menu button at every responsive breakpoint.
- Preserved the existing desktop sidebar, mobile drawer animation, mobile bottom navigation, route destinations, and page layouts.
- Kept consolidated menu destinations reachable on shorter viewports with bounded menu scrolling.
- Added a Settings → Appearance surface with Light, Dark, and System options using the existing Kondo design system.

## Performance Improvements

- No material performance changes.

## Security Improvements

- No security behavior changes.

## Files Created

- `src/components/features/settings/AppearanceSelector.tsx`
- `app/(platform)/settings/appearance/page.tsx`

## Files Modified

- `src/components/app/AppShell.tsx`
- `src/components/features/explore/ExploreMenu.tsx`
- `app/(platform)/settings/page.tsx`
- `package.json`
- `package-lock.json`
- `docs/COMPONENTS.md`
- `docs/CHANGELOG.md`

## Files Removed

- None.

## Breaking Changes

None. Business logic, APIs, database schema, authentication, routes, primary navigation, and mobile bottom navigation remain unchanged.

## Migration Notes

- No dependency installation or database migration is required.
- Restart the development server or refresh after recompilation.
- Theme choice remains a device-local preference managed by the existing theme provider.

## Next Recommended Tasks

- None for this refinement.

⸻

# Version 0.3.3

Date:
2026-07-15

## Summary

Rolled back the version 0.3.2 header simplification and Appearance-page relocation at the user's request. The visible interface and theme control are restored to the validated version 0.3.1 behavior while preserving the append-only development history.

## Features Added

- None.

## Features Modified

- Restored the global search field, theme toggle, notification indicator, profile avatar, and Explore menu in the application header.
- Restored the original four-item Explore dropdown.
- Restored the previous Settings page presentation.
- Updated the package version from 0.3.2 to 0.3.3 to record the rollback.

## Bugs Fixed

- None. This release intentionally reverts the preceding UI refinement.

## Database Changes

- No new tables.
- No schema changes.
- No new indexes.
- No Prisma migrations.

## API Changes

- No new endpoints.
- No updated endpoints.
- No removed endpoints.

## UI/UX Changes

- Reverted the minimal greeting-and-menu header introduced in 0.3.2.
- Returned Light/Dark switching to the top application bar.
- Removed Settings → Appearance and its Light, Dark, and System selection surface.
- Kept Explore Jiaxing and all pre-existing navigation behavior unchanged from version 0.3.1.

## Performance Improvements

- No material performance changes.

## Security Improvements

- No security behavior changes.

## Files Created

- None.

## Files Modified

- `src/components/app/AppShell.tsx`
- `src/components/features/explore/ExploreMenu.tsx`
- `app/(platform)/settings/page.tsx`
- `package.json`
- `package-lock.json`
- `docs/COMPONENTS.md`
- `docs/CHANGELOG.md`

## Files Removed

- `src/components/features/settings/AppearanceSelector.tsx`
- `app/(platform)/settings/appearance/page.tsx`

## Breaking Changes

None. Business logic, APIs, database schema, authentication, routes outside the reverted Appearance route, primary navigation, and mobile bottom navigation are unchanged.

## Migration Notes

- No dependency installation or database migration is required.
- Restart the development server or refresh after recompilation.
- Any theme preference already stored by `next-themes` remains intact; the header toggle again switches between Light and Dark.

## Next Recommended Tasks

- None for this rollback.

⸻

# Version 0.3.4

Date:
2026-07-15

## Summary

Applied the requested header cleanup and theme-settings relocation following the documented 0.3.3 rollback. The authenticated header now contains only a greeting and one menu button, while the existing theme behavior lives under Settings → Appearance.

## Features Added

- None. Existing theme behavior was relocated rather than expanded.

## Features Modified

- Moved theme selection from the header to a dedicated Appearance settings page.
- Exposed the existing Light, Dark, and system-following modes through the current `next-themes` provider.
- Consolidated Search, Notifications, Profile, Explore Jiaxing, City Events, Settings, and Language access into the existing desktop menu and mobile drawer after removing their standalone header controls.
- Updated the package version from 0.3.3 to 0.3.4.

## Bugs Fixed

- None.

## Database Changes

- No new tables.
- No schema changes.
- No new indexes.
- No Prisma migrations.

## API Changes

- No new endpoints.
- No updated endpoints.
- No removed endpoints.

## UI/UX Changes

- Removed the Light/Dark toggle, search field, notification button, and profile avatar from the visible header.
- Reduced the header to a user greeting and one menu button at every responsive breakpoint.
- Preserved the existing desktop sidebar, mobile drawer animation, mobile bottom navigation, route destinations, and page layouts.
- Kept consolidated menu destinations reachable on shorter viewports with bounded menu scrolling.
- Added a Settings → Appearance surface with Light, Dark, and System options using the existing Kondo design system.

## Performance Improvements

- No material performance changes.

## Security Improvements

- No security behavior changes.

## Files Created

- `src/components/features/settings/AppearanceSelector.tsx`
- `app/(platform)/settings/appearance/page.tsx`

## Files Modified

- `src/components/app/AppShell.tsx`
- `src/components/features/explore/ExploreMenu.tsx`
- `app/(platform)/settings/page.tsx`
- `package.json`
- `package-lock.json`
- `docs/COMPONENTS.md`
- `docs/CHANGELOG.md`

## Files Removed

- None.

## Breaking Changes

None. Business logic, APIs, database schema, authentication, existing route behavior, primary navigation, and mobile bottom navigation remain unchanged.

## Migration Notes

- No dependency installation or database migration is required.
- Restart the development server or refresh after recompilation.
- Theme choice remains a device-local preference managed by the existing theme provider.

## Next Recommended Tasks

- None for this refinement.

⸻

# Version 0.3.5

Date:
2026-07-15

## Summary

Refined the authenticated top navigation by replacing the user greeting with the existing Kondo logo and brand name, while restoring Search and Notifications alongside the unchanged menu behavior. This release is limited to the requested header UI refinement.

## Features Added

- None.

## Features Modified

- Replaced the header greeting with the existing `KondoLogo` brand mark and wordmark.
- Restored the existing global Search and Notifications entry points to the visible header.
- Updated the package version from 0.3.4 to 0.3.5.

## Bugs Fixed

- None.

## Database Changes

- No new tables.
- No schema changes.
- No new indexes.
- No Prisma migrations.

## API Changes

- No new endpoints.
- No updated endpoints.
- No removed endpoints.

## UI/UX Changes

- Established the requested header hierarchy: Kondo identity, Search, Notifications, and Menu.
- Preserved the existing header height, spacing rhythm, sticky behavior, responsive breakpoints, mobile drawer, desktop menu, and bottom navigation.
- Kept Search, Notifications, and both viewport-specific menu controls linked to their existing destinations and handlers.

## Performance Improvements

- No material performance changes.

## Security Improvements

- No security behavior changes.

## Files Created

- None.

## Files Modified

- `src/components/app/AppShell.tsx`
- `package.json`
- `package-lock.json`
- `docs/COMPONENTS.md`
- `docs/CHANGELOG.md`

## Files Removed

- None.

## Breaking Changes

None. Functionality, business logic, APIs, database schema, routing, navigation structure, existing features, and theme settings remain unchanged.

## Migration Notes

- No dependency installation or database migration is required.
- Restart the development server or refresh after recompilation.

## Next Recommended Tasks

- None for this refinement.

⸻

# Version 0.3.6

Date:
2026-07-15

## Summary

Rolled back every project-source modification made during the two-hour window from 20:05 to 22:05 PDT at the user's request. This removes versions 0.3.4 and 0.3.5 from the active interface while preserving their append-only historical records, and restores the validated version 0.3.3 behavior.

## Features Added

- None.

## Features Modified

- Restored the application header, Explore dropdown, and Settings presentation to their version 0.3.3 behavior.
- Restored the header Light/Dark toggle, global Search, notification indicator, profile avatar, and Explore entry point.
- Updated the package version from 0.3.5 to 0.3.6 to record the two-hour rollback.

## Bugs Fixed

- None. This release intentionally reverts recent UI refinements.

## Database Changes

- No new tables.
- No schema changes.
- No new indexes.
- No Prisma migrations.

## API Changes

- No new endpoints.
- No updated endpoints.
- No removed endpoints.

## UI/UX Changes

- Reverted the minimal greeting/menu header introduced in 0.3.4.
- Reverted the Kondo-branded header refinement introduced in 0.3.5.
- Removed Settings → Appearance and restored theme switching to the header.
- Restored the original four-item Explore menu and the prior mobile drawer contents.

## Performance Improvements

- No material performance changes.

## Security Improvements

- No security behavior changes.

## Files Created

- None.

## Files Modified

- `src/components/app/AppShell.tsx`
- `src/components/features/explore/ExploreMenu.tsx`
- `app/(platform)/settings/page.tsx`
- `package.json`
- `package-lock.json`
- `docs/COMPONENTS.md`
- `docs/CHANGELOG.md`

## Files Removed

- `src/components/features/settings/AppearanceSelector.tsx`
- `app/(platform)/settings/appearance/page.tsx`

## Breaking Changes

None. The rollback restores a previously validated interface. Business logic, APIs, database schema, authentication, Explore Jiaxing content, primary navigation, and mobile bottom navigation are unchanged.

## Migration Notes

- No dependency installation or database migration is required.
- Restart the development server or refresh after recompilation.
- Theme preferences already stored by `next-themes` remain intact.

## Next Recommended Tasks

- None for this rollback.

⸻

# Version 0.4.0

Date:
2026-07-15

## Summary

Merged the Student and Help navigation destinations into a unified Student Hub and used the released fifth position for a lightweight, production-ready direct Messages module. Existing guide and help functionality remains available through its stable routes, while members can now start private conversations naturally from Kondo content without friend requests or follow state.

## Features Added

- Added Student Hub as the central entry point for Arrival Guide, Student Resources, Questions & Answers, Checklists, Student Tips, Helpful Articles, and Student Events.
- Added searchable direct-conversation history with previews, timestamps, unread badges, text messages, emoji shortcuts, and responsive message bubbles.
- Added first-message conversation creation with a canonical two-user identity that prevents duplicate direct threads.
- Added reusable Message actions on member profiles, community posts, marketplace listings, comments, help questions, and Student Hub answers.
- Added member block/unblock and conversation-report workflows.
- Added future-ready message types and provider-neutral attachment metadata for later image/document support; uploads are intentionally not enabled in this release.

## Features Modified

- Replaced the Student and Help bottom/sidebar entries with Student Hub and Messages.
- Preserved `/guides` and `/help` as stable, fully functional content routes and made both activate the Student Hub navigation state.
- Enabled the previously planned profile and marketplace contact actions through the new private messaging flow.
- Extended post, comment, question, and answer presentation with contextual direct-message entry points.
- Updated the deterministic demo seed with a representative direct conversation and message notification.

## Bugs Fixed

- Prevented either participant from creating a duplicate direct history by sorting both user IDs into one unique conversation key.
- Prevented members from messaging themselves, inactive recipients, non-participant conversations, or users involved in a block relationship.
- Prevented rapid duplicate delivery of an identical message from the same sender.

## Database Changes

- Added `Conversation`, `ConversationParticipant`, `Message`, and `UserBlock` tables.
- Added `ConversationType` and `MessageType` enums.
- Added participant membership/read/archive fields and nullable future attachment metadata.
- Added a unique direct-conversation key plus indexes for inbox ordering, participant lookup/read state, message chronology/sender activity, and block lookup.
- Added Prisma migration `20260715190000_student_hub_messages`.

## API Changes

- Added `POST /api/messages` for first-message direct-conversation creation.
- Added `POST /api/conversations/:id/messages` for replies.
- Added `PATCH /api/conversations/:id/read` for participant read state.
- Added `POST /api/conversations/:id/report` for moderation reports.
- Added `POST /api/users/:id/block` and `DELETE /api/users/:id/block` for block state.
- Added Zod validation, same-origin checks, authentication, participant authorization, general send limits, new-recipient limits, block/report limits, and audit logging where required.
- Removed no endpoints.

## UI/UX Changes

- Added a responsive Student Hub dashboard that composes existing guides, help content, checklists, and events without redesigning their source modules.
- Added Messages list, empty/search states, conversation detail, emoji picker, composer feedback, safety actions, and attachment-readiness messaging.
- Kept the mobile bottom navigation at exactly five items: Home, Communities, Marketplace, Student Hub, and Messages.
- Preserved Home, Communities, Marketplace, Explore Jiaxing, Search, notifications, profiles, header utilities, animations, and the existing design system.

## Performance Improvements

- Added query indexes for all primary conversation, participant, message, and block access paths.
- Bounded the inbox to the latest 50 conversations and each opened conversation to the latest 100 messages for a lightweight MVP response.
- Kept authenticated reads in Server Components and direct-message writes transactional.

## Security Improvements

- Added a 2,000-character validated plain-text message boundary and escaped React rendering.
- Added 30-message-per-minute, 8-new-conversation-per-hour, block, and report limits using the existing rate-limit layer.
- Added rapid identical-message rejection, active-recipient checks, participant-only replies/read/report actions, directional block storage with bidirectional send prevention, idempotent open reports, and block/report audit logs.
- Preserved conversation history when blocked so moderation evidence is not silently destroyed.

## Files Created

- `app/(platform)/student-hub/page.tsx`
- `app/(platform)/messages/page.tsx`
- `app/(platform)/messages/new/page.tsx`
- `app/(platform)/messages/[id]/page.tsx`
- `app/api/messages/route.ts`
- `app/api/conversations/[id]/messages/route.ts`
- `app/api/conversations/[id]/read/route.ts`
- `app/api/conversations/[id]/report/route.ts`
- `app/api/users/[id]/block/route.ts`
- `src/components/features/messages/MessageUserButton.tsx`
- `src/components/features/messages/MessageComposer.tsx`
- `src/components/features/messages/MarkConversationRead.tsx`
- `src/components/features/messages/ConversationActions.tsx`
- `src/lib/messaging.ts`
- `prisma/migrations/20260715190000_student_hub_messages/migration.sql`
- `tests/unit/messaging.test.ts`

## Files Modified

- `src/components/app/AppShell.tsx`
- `src/components/features/community/FeedPost.tsx`
- `app/(platform)/home/page.tsx`
- `app/(platform)/communities/[slug]/page.tsx`
- `app/(platform)/profile/[username]/page.tsx`
- `app/(platform)/marketplace/[slug]/page.tsx`
- `app/(platform)/help/[slug]/page.tsx`
- `src/lib/platform-queries.ts`
- `src/lib/presentation.ts`
- `src/lib/validation.ts`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `tests/unit/validation.test.ts`
- `package.json`
- `package-lock.json`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/API.md`
- `docs/COMPONENTS.md`
- `docs/SECURITY.md`
- `docs/DEPLOYMENT.md`
- `docs/ROADMAP.md`
- `docs/CHANGELOG.md`

## Files Removed

- None.

## Breaking Changes

None at the route or API level. The intended primary-navigation contract changes from separate Student and Help entries to Student Hub and Messages; the original `/guides` and `/help` URLs and functionality remain compatible.

## Migration Notes

- Run `npm run db:generate` after updating dependencies/source.
- Apply the additive migration with `npx prisma migrate deploy` before starting this version against an existing database.
- Do not run `npm run db:seed` against production; the seed is destructive and intended only for local/demo reset data.
- Existing users, guides, questions, answers, posts, listings, sessions, and navigation-linked URLs require no data backfill.
- In-process abuse limits are appropriate for the single-instance MVP; move them to a shared Redis-compatible store before horizontally scaling messaging.

## Next Recommended Tasks

- Add signed, validated image/document attachments with retention and malware-scanning policy.
- Add cursor pagination, delivery/read receipts, archive controls, and asynchronous notification delivery.
- Move all messaging abuse limits to shared storage before multi-instance production traffic.
- Add moderator evidence review and end-to-end tests for cross-user authorization, blocking, reporting, and mobile navigation.

⸻

# Version 0.4.1

Date:
2026-07-15

## Summary

Completed a source-level technical and product audit of Kondo 0.4.0 and added the official single-source-of-truth document covering every current page, component, module, user action, Prisma model, migration, API, form, dependency, reusable system, administration/CMS gap, mock-data dependency, missing backend rule, CRUD status, security limitation, and module dependency.

## Features Added

- Added the official implementation audit with evidence-backed status and completion estimates for all 18 current product/system modules.
- Added complete page, component, database, API, form, navigation, dependency, CMS, Admin, CRUD, test, security, mock-data, and folder-structure inventories.
- Added an ordered implementation reference based on the audited dependency and risk structure.

## Features Modified

- No application feature was modified.
- Recorded this documentation-only audit release in the development history.

## Bugs Fixed

- None. This task was analysis-only and intentionally made no code or behavior changes.
- Documented the critical public Search API raw-user serialization exposure and other authorization/status gaps without changing them.

## Database Changes

- No new tables.
- No schema changes.
- No new indexes.
- No Prisma migrations.

## API Changes

- No new endpoints.
- No updated endpoints.
- No removed endpoints.
- Documented all 32 existing HTTP operations and their current validation, authorization, responses, and limitations.

## UI/UX Changes

- No pages, components, layouts, animations, navigation, or responsive behavior changed.

## Performance Improvements

- None.

## Security Improvements

- No security behavior changed.
- Documented the current critical Search serialization exposure, read-authorization gaps, session/account lifecycle limitations, in-process rate limits, absent secure-media pipeline, and current dependency advisory state.

## Files Created

- `docs/TECHNICAL_PRODUCT_AUDIT.md`

## Files Modified

- `docs/CHANGELOG.md`

## Files Removed

- None.

## Breaking Changes

None. This release changes documentation only.

## Migration Notes

- No package installation, application restart, data backfill, or database migration is required.
- The application package remains version 0.4.0; 0.4.1 identifies the documentation audit release.
- The audited source passed lint, typecheck, all 17 unit tests, and a production build from a disposable exact copy.

## Next Recommended Tasks

- Treat the public Search API raw-user serialization exposure as the first production blocker.
- Enforce private-community and direct-record publication/status authorization consistently.
- Complete operational moderation and the missing core CRUD loops in the order recorded by the audit.

⸻

# Version 0.4.2

Date:
2026-07-15

## Summary

Completed the Module 0 production-blocker stabilization for data exposure, content visibility, mutation target authorization, unsupported trust claims, and destructive seed safety. This release changes no product navigation, module, CMS, database schema, or visual design.

## Features Added

- Added a typed shared visibility-policy layer for private communities, published posts/questions/answers/guides, active marketplace listings, and polymorphic bookmark targets.
- Added a minimal safe public-user serializer and stable Search DTOs backed by explicit Prisma selections.
- Added an explicit destructive-seed guard that requires local/demo opt-in and rejects production unconditionally.
- Added focused security regression tests for Search, visibility, target mutations, lifecycle statuses, and seed execution.

## Features Modified

- Search now requires an authenticated session, excludes inactive users and inaccessible content, and returns only explicit non-sensitive DTOs.
- Community directories, home content, Student Hub events, profiles, direct community pages, Search, reactions, and bookmarks now share the same private-community membership policy.
- Normal user reads now consistently require `ACTIVE` marketplace listings, `PUBLISHED` questions/answers/posts, and published guides.
- Favorites, helpful votes, guide progress, reactions, and bookmark reads/writes now validate target existence, state, parent state, and accessibility before acting.

## Bugs Fixed

- Removed the critical Search exposure of complete Prisma `User` records, including password hashes and internal account/security fields.
- Prevented Search from revealing inaccessible private communities, their posts, or contextual author data.
- Prevented non-members from opening private-community details and prevented unpublished comment/post counts from leaking through normal views.
- Prevented direct access to non-active marketplace listings and non-published questions.
- Prevented writes against inactive listings, unpublished answers/questions, unpublished guide steps, missing IDs, unpublished posts, and inaccessible private-community posts.
- Removed automatic user verification/trust badges and unsupported “verified members,” “trusted member,” and “Reviewed by Kondo” claims.
- Prevented accidental destructive database seeding in production.

## Database Changes

- No new tables.
- No modified schema.
- No new indexes.
- No Prisma migrations.

## API Changes

- Updated `GET /api/search` from public to authenticated access.
- Changed Search responses from Prisma-shaped records to stable minimal DTOs.
- Marked personalized Search responses `private, no-store, max-age=0` and added `Vary: Cookie`.
- Updated listing favorite, answer vote, guide progress, post reaction, bookmark, marketplace read, and answer-creation handlers to enforce centralized target visibility.
- Inaccessible, inactive, unpublished, or missing resources now return controlled `404` JSON errors where applicable.
- No endpoints were added or removed.

## UI/UX Changes

- Removed unsupported user/member trust badges and official-review wording.
- Replaced “verified members” marketplace copy with neutral active-listing/member wording.
- Preserved all existing pages, layouts, navigation, interactions, animations, and responsive behavior.

## Performance Improvements

- Reduced Search database payloads through explicit minimal `select` projections.
- Applied visibility and lifecycle filters directly in Prisma instead of loading forbidden collections for in-memory filtering.

## Security Improvements

- Added authenticated, member-scoped, non-shareable Search.
- Added safe public serializers that cannot automatically expose new Prisma fields.
- Added shared private-community and content-lifecycle authorization across reads and mutations.
- Added controlled target validation before favorites, votes, progress, reactions, and bookmarks.
- Added production-proof destructive seed blocking through `NODE_ENV`, `VERCEL_ENV`, and explicit opt-in checks.

## Files Created

- `src/lib/content-visibility.ts`
- `src/lib/seed-safety.ts`
- `tests/unit/content-visibility.test.ts`
- `tests/unit/protected-target-routes.test.ts`
- `tests/unit/search-route-auth.test.ts`
- `tests/unit/search-security.test.ts`
- `tests/unit/seed-safety.test.ts`

## Files Modified

- `.env.example`
- `README.md`
- `app/(platform)/communities/[slug]/page.tsx`
- `app/(platform)/guides/[slug]/page.tsx`
- `app/(platform)/help/[slug]/page.tsx`
- `app/(platform)/marketplace/[slug]/page.tsx`
- `app/(platform)/marketplace/page.tsx`
- `app/(platform)/profile/[username]/page.tsx`
- `app/(platform)/profile/page.tsx`
- `app/(platform)/search/page.tsx`
- `app/(platform)/student-hub/page.tsx`
- `app/api/answers/[id]/votes/route.ts`
- `app/api/bookmarks/[targetType]/[targetId]/route.ts`
- `app/api/guides/progress/[stepId]/route.ts`
- `app/api/marketplace/[id]/favorites/route.ts`
- `app/api/marketplace/route.ts`
- `app/api/posts/[id]/reactions/route.ts`
- `app/api/questions/[id]/answers/route.ts`
- `app/api/search/route.ts`
- `src/lib/platform-queries.ts`
- `src/lib/serializers.ts`
- `prisma/seed.ts`
- `package.json`
- `package-lock.json`
- `next-env.d.ts`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/COMPONENTS.md`
- `docs/DATABASE.md`
- `docs/DEPLOYMENT.md`
- `docs/ROADMAP.md`
- `docs/SECURITY.md`
- `docs/TECHNICAL_PRODUCT_AUDIT.md`

## Files Removed

- None.

## Breaking Changes

- `GET /api/search` now requires an authenticated session and returns explicit DTOs instead of raw Prisma-shaped records. Any external consumer depending on anonymous Search or undocumented fields must authenticate and adopt the documented DTO contract.

## Migration Notes

- No Prisma migration or data backfill is required.
- The application package version is now `0.4.2`.
- Intentional local/demo resets must use `KONDO_ALLOW_DESTRUCTIVE_SEED=true npm run db:seed`.
- Never configure `KONDO_ALLOW_DESTRUCTIVE_SEED=true` in production; production execution is blocked even if the variable is present.
- No new CMS, verification model, role, navigation entry, or product module was introduced.

## Next Recommended Tasks

- Add end-to-end authorization tests against a disposable PostgreSQL database for private-content and lifecycle boundaries.
- Continue the existing roadmap for shared rate limits, account recovery/session management, secure media, and operational moderation.
- Track and upgrade the framework dependency when Next.js releases a stable fix for the documented moderate PostCSS advisories.

⸻

# Version 0.5.0

Date:
2026-07-16

## Summary

Implemented Module 3 as Kondo’s operational Admin moderation foundation. This release adds a permission-separated report workflow, retained and role-redacted evidence, internal case notes, assignment and lifecycle controls, a global AuditLog browser, atomic mutation/audit guarantees, concurrency protection, and real PostgreSQL integration plus API-level end-to-end validation. It does not implement business-specific moderation for Communities, Marketplace, Guides, or Q&A.

## Features Added

- Added a formal server-side permission matrix separating `MODERATOR`, `ADMIN`, and `SUPER_ADMIN`.
- Added a paginated and filterable report queue with role-scoped case visibility.
- Added a report detail workspace with assignment data, member context, preserved evidence, internal notes, decision history, and case AuditLog timeline.
- Added claim, assignment, reassignment, unassignment, resolution, dismissal, and controlled reopening workflows.
- Added typed report decisions and mandatory resolution text.
- Added retained conversation evidence snapshots containing the latest 50 messages at report time.
- Added a filtered and paginated global AuditLog browser for Admin and Super Admin.
- Added optimistic report versions, PostgreSQL concurrency protection, and duplicate active conversation-report prevention.
- Added a disposable PostgreSQL test-database preparation script.
- Added PostgreSQL integration coverage and an API-level report-to-resolution end-to-end workflow.

## Features Modified

- Changed the Admin overview from a read-only moderation preview to an entry point linked to the operational report queue.
- Restricted the Admin overview to Admin and Super Admin while routing Moderator operations to the report queue.
- Exposed the existing Admin destination in the authorized mobile drawer without changing bottom navigation.
- Changed conversation reporting to capture immutable evidence and write report creation plus AuditLog atomically.
- Changed block/unblock so the relationship mutation and AuditLog write share one Prisma transaction.
- Extended server authorization from broad Admin access to exact per-operation permissions.
- Updated the demo seed with report assignment metadata and an internal moderation note.
- Changed `npm test` to prepare and migrate an isolated PostgreSQL test database before running Vitest.

## Bugs Fixed

- Prevented moderators from accessing other moderators’ assigned cases or platform-wide Admin data.
- Prevented stale Admin actions from overwriting newer assignments or report decisions.
- Prevented two moderators from successfully claiming the same report concurrently.
- Prevented concurrent requests from creating duplicate active reports for the same reporter and conversation.
- Prevented report mutations from committing when the mandatory AuditLog insert fails.
- Prevented conversation deletion from erasing the evidence snapshot required for moderation review.
- Prevented member-facing APIs from exposing internal notes, sensitive evidence identifiers, attachment object keys, or request security metadata.
- Added controlled `404`, `403`, and `409` behavior for missing targets, forbidden actions, invalid lifecycle transitions, and version conflicts.

## Database Changes

- Added enum `ReportDecision`.
- Added enum `ReportEvidenceKind`.
- Added table `ReportNote`.
- Added table `ReportEvidence`.
- Modified `Report` with subject, assignment author/time, typed decision, resolver, reopening metadata, and optimistic version fields.
- Changed the report reporter relation to `ON DELETE SET NULL` so account deletion preserves case history.
- Added report queue, reporter, subject, assignee, note, and evidence indexes.
- Added a partial PostgreSQL unique index for one active conversation report per reporter and conversation.
- Added a terminal-report lifecycle check constraint.
- Added Prisma migration `20260716090000_operational_moderation`.

## API Changes

- Added `GET /api/admin/reports`.
- Added `GET /api/admin/reports/:id`.
- Added `POST /api/admin/reports/:id/assignment`.
- Added `POST /api/admin/reports/:id/notes`.
- Added `POST /api/admin/reports/:id/transition`.
- Added `GET /api/admin/audit`.
- Updated `POST /api/conversations/:id/report` to preserve evidence, reuse the active case under concurrency, and audit atomically.
- Updated `POST /api/users/:id/block` and `DELETE /api/users/:id/block` to audit within the same transaction.
- Added explicit safe moderation DTOs; no Admin endpoint returns raw Prisma objects.

## UI/UX Changes

- Added `/admin/reports` with responsive filters, case cards, counts, timestamps, and pagination.
- Added `/admin/reports/[id]` with evidence, internal notes, audit timeline, and permission-scoped case actions.
- Added `/admin/audit` with responsive filters, redacted change data, and pagination.
- Added permission-aware Admin navigation.
- Added authorized Admin access to the mobile drawer while preserving the existing five bottom-navigation items.
- Preserved the existing application design system, global layout, product navigation, and business-module interfaces.

## Performance Improvements

- Added database indexes aligned with report queue, ownership, subject, note, and evidence queries.
- Added bounded pagination for report and AuditLog lists.
- Limited captured conversation evidence to the latest 50 messages.
- Used optimistic compare-and-swap updates instead of database-wide locks for report assignment and transitions.

## Security Improvements

- Enforced exact Admin permissions on every page and endpoint server-side.
- Redacted evidence at three levels: Moderator identity-redacted, Admin operational, and Super Admin security metadata.
- Recursively redacted password, session/token, OAuth-token, and attachment-object-key fields from AuditLog API responses.
- Made every Admin report mutation atomic with its AuditLog event.
- Preserved evidence and report history when source conversations or referenced users are deleted.
- Added same-origin validation to every new Admin mutation.
- Marked all Admin API responses private, non-cacheable, and cookie-varying.
- Added role, participation, reason/detail, lifecycle, decision, resolution, and eligible-assignee validation.

## Files Created

- `app/admin/audit/page.tsx`
- `app/admin/reports/page.tsx`
- `app/admin/reports/[id]/page.tsx`
- `app/api/admin/audit/route.ts`
- `app/api/admin/reports/route.ts`
- `app/api/admin/reports/[id]/route.ts`
- `app/api/admin/reports/[id]/assignment/route.ts`
- `app/api/admin/reports/[id]/notes/route.ts`
- `app/api/admin/reports/[id]/transition/route.ts`
- `prisma/migrations/20260716090000_operational_moderation/migration.sql`
- `scripts/prepare-test-db.mjs`
- `src/components/features/admin/AdminNav.tsx`
- `src/components/features/admin/ReportCaseActions.tsx`
- `src/lib/admin-auth.ts`
- `src/lib/moderation.ts`
- `tests/integration/moderation-api.e2e.test.ts`
- `tests/integration/moderation-postgres.test.ts`
- `tests/unit/admin-auth.test.ts`
- `tests/unit/block-route.test.ts`
- `tests/unit/moderation.test.ts`

## Files Modified

- `.env.example`
- `README.md`
- `app/admin/page.tsx`
- `app/api/conversations/[id]/report/route.ts`
- `app/api/users/[id]/block/route.ts`
- `package.json`
- `package-lock.json`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/components/app/AppShell.tsx`
- `src/lib/audit.ts`
- `src/lib/authorization.ts`
- `src/lib/server-auth.ts`
- `src/lib/validation.ts`
- `tests/unit/authorization.test.ts`
- `tests/unit/validation.test.ts`
- `vitest.config.mts`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/COMPONENTS.md`
- `docs/DATABASE.md`
- `docs/DEPLOYMENT.md`
- `docs/ROADMAP.md`
- `docs/SECURITY.md`

## Files Removed

- None.

## Breaking Changes

- `npm test` now requires access to an isolated PostgreSQL database. Local Docker Compose uses `kondo_module3_test`; CI must provide `TEST_DATABASE_URL`.
- The Prisma migration must be deployed before running application version 0.5.0 because the report APIs require the new enums, tables, fields, indexes, and constraints.
- Moderator access to `/admin` now redirects to `/admin/reports`; the platform-wide overview is reserved for Admin and Super Admin.
- Conversation reports using reason `OTHER` now require at least 10 characters of explanatory detail.

## Migration Notes

- Back up production and apply `npx prisma migrate deploy` before deploying the application.
- Migration `20260716090000_operational_moderation` preserves historical reports, closes extra active duplicate conversation cases as `DISMISSED/DUPLICATE`, backfills legacy terminal metadata, preserves legacy active-resolution text as internal notes, then enables uniqueness and lifecycle constraints.
- Review the duplicate-case update count in production before deployment.
- Do not point `TEST_DATABASE_URL` at preview or production data.
- Run `npm run db:generate` after updating the source or dependencies.
- The application package version is now `0.5.0`.

## Next Recommended Tasks

- Add browser-driven responsive E2E coverage for the Admin queue, detail actions, and AuditLog filters.
- Add user status/session controls and business-specific content actions on top of this completed permission/audit foundation.
- Move report, block, and messaging rate limits to shared Redis-compatible storage before horizontal scaling.
- Define formal evidence retention, legal hold, and privacy-erasure operating policies before production moderation volume.

# Version 0.5.1

Date:
2026-07-16

## Summary

Stabilized the integration of Modules 0–3 across security, shared technical foundations, authentication, Admin permissions, and moderation. The release makes account role/status changes effective from PostgreSQL on every request, verifies revocation and expiry behavior, standardizes controlled API failures, removes sensitive development logging, completes Admin route states, and expands real PostgreSQL regression coverage.

## Features Added

- Added structured server error logging limited to non-sensitive operational event and error-classification fields.
- Added an Admin loading skeleton, generic retryable error boundary, non-disclosing not-found surface, and explicit permission-denied page.
- Added reusable database-session revocation helpers and opportunistic expired-session cleanup.
- Added PostgreSQL authentication lifecycle coverage for current roles, suspended/deactivated accounts, expiry, and revocation.

## Features Modified

- Changed authenticated-user resolution to load the current `User` through the hashed database `Session` relation in one query.
- Changed successful login so session creation and `LOGIN_SUCCESS` auditing execute in one transaction.
- Changed registration so user creation, session creation, and `USER_REGISTERED` auditing execute in one transaction.
- Changed failed-login auditing to use a SHA-256 credential identifier instead of storing an email address.
- Changed Module 0–3 unexpected API failures to return generic private JSON `500` responses.
- Changed denied Admin page access to use the dedicated permission-denied surface.
- Changed member-facing bookmark visibility so global moderation roles do not bypass private-community membership.

## Bugs Fixed

- Prevented stale JWT roles from retaining permissions after a database role change.
- Confirmed and covered immediate rejection of sessions belonging to suspended or deactivated users.
- Prevented revoked and expired sessions from authenticating; expired presented sessions are cleaned up.
- Prevented login and registration from leaving audit/session state partially committed.
- Prevented raw backend exceptions from escaping the Search, Admin moderation, conversation-report, and block/unblock APIs.
- Removed development login email logging and Prisma query/error console logging.
- Prevented moderators from bookmarking private-community posts without membership.

## Database Changes

- No schema changes.
- No new tables, indexes, or Prisma migrations.
- Added integration validation against the existing `User`, `Session`, `AuditLog`, `Report`, and evidence tables.

## API Changes

- Updated authentication responses to be private and non-cacheable.
- Updated login, registration, logout, current-user, Search, Admin moderation, conversation-report, and block/unblock failure handling.
- Preserved all existing endpoint paths and successful response shapes.

## UI/UX Changes

- Added `/admin/forbidden`.
- Added Admin loading, error, and not-found route states using the existing design system.
- No application redesign or navigation changes.

## Performance Improvements

- Resolves the database session and current user with one relational query.
- Removes verbose Prisma query logging from development.
- Opportunistically deletes an expired session only when that stale credential is presented.

## Security Improvements

- Uses the current PostgreSQL role and status instead of trusting authorization claims from an older JWT.
- Keeps suspended/deactivated users, revoked sessions, and expired sessions out of authenticated routes.
- Makes successful login/registration security mutations atomic with AuditLog writes.
- Removes emails, passwords, request bodies, exception messages, stacks, IP addresses, user agents, and user identifiers from structured server error logs.
- Keeps member bookmark operations scoped to actual private-community membership.

## Files Created

- `app/admin/error.tsx`
- `app/admin/forbidden/page.tsx`
- `app/admin/loading.tsx`
- `app/admin/not-found.tsx`
- `src/lib/logger.ts`
- `tests/integration/auth-postgres.test.ts`
- `tests/unit/conversation-report-route.test.ts`
- `tests/unit/logout-route.test.ts`
- `tests/unit/server-auth.test.ts`

## Files Modified

- `app/admin/reports/[id]/page.tsx`
- `app/api/admin/audit/route.ts`
- `app/api/admin/reports/route.ts`
- `app/api/admin/reports/[id]/route.ts`
- `app/api/admin/reports/[id]/assignment/route.ts`
- `app/api/admin/reports/[id]/notes/route.ts`
- `app/api/admin/reports/[id]/transition/route.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/me/route.ts`
- `app/api/auth/register/route.ts`
- `app/api/conversations/[id]/report/route.ts`
- `app/api/search/route.ts`
- `app/api/users/[id]/block/route.ts`
- `package.json`
- `package-lock.json`
- `src/lib/admin-auth.ts`
- `src/lib/content-visibility.ts`
- `src/lib/prisma.ts`
- `src/lib/request.ts`
- `src/lib/server-auth.ts`
- `tests/unit/admin-auth.test.ts`
- `tests/unit/block-route.test.ts`
- `tests/unit/login-route.test.ts`
- `tests/unit/protected-target-routes.test.ts`
- `tests/unit/search-route-auth.test.ts`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/COMPONENTS.md`
- `docs/DATABASE.md`
- `docs/DEPLOYMENT.md`
- `docs/ROADMAP.md`
- `docs/SECURITY.md`

## Files Removed

- None.

## Breaking Changes

- None.

## Migration Notes

- No Prisma migration is required for version 0.5.1.
- Keep the three existing migrations applied before deployment.
- No environment variable or manual data correction is required.

## Next Recommended Tasks

- Begin Module 4 with Country → City → University consistency, server validation, resumable onboarding, reference-data statuses, and audited Admin CRUD.
- Preserve the in-memory rate-limit limitation until the shared-store module is reached.
- Add browser-driven E2E coverage in Module 20 as planned.

⸻

# Version 0.6.0

Date:
2026-07-16

## Summary

Implemented Module 4: resumable and editable onboarding plus operational Country, City, and University reference data. Kondo now validates study-location coherence in the application and PostgreSQL, filters onboarding to active reviewed records, repairs historical mismatches, and provides Admin/Super Admin with a complete audited reference-data CMS.

## Features Added

- Added active and verified lifecycle fields for countries and cities and an active lifecycle for universities.
- Added PostgreSQL consistency triggers for University country/city and User study city/university relationships.
- Added onboarding draft persistence through `PATCH /api/onboarding`.
- Added completed-onboarding editing through the existing `/onboarding` flow.
- Added dynamic university filtering by the selected study city.
- Added searchable, paginated Admin reference-data management for countries, cities, and universities.
- Added audited create, read, update, and dependency-safe delete operations.

## Features Modified

- Changed onboarding from a one-time flow into resumable and editable student-context management.
- Changed onboarding completion/update so validation, user mutation, and AuditLog insertion are atomic.
- Changed the Settings profile entry to open the editable student-context flow.
- Changed seeded reference records to explicit active/verified state.
- Corrected the seeded Shanghai/Peking University mismatch.
- Extended the Admin permission matrix with `REFERENCE_DATA_VIEW` and `REFERENCE_DATA_MANAGE`.

## Bugs Fixed

- Prevented selection of a university outside the selected study city.
- Prevented inactive or unverified universities from onboarding.
- Prevented inactive countries/cities and inactive parent records from appearing in onboarding.
- Corrected existing University country IDs that disagreed with their City.
- Corrected existing User study cities that disagreed with their University.
- Prevented hard deletion of reference records still used by users, communities, listings, cities, or universities.
- Prevented reference mutations from committing when their mandatory AuditLog write fails.

## Database Changes

- Added `Country.isActive`.
- Added `Country.verified`.
- Added `City.isActive`.
- Added `City.verified`.
- Added `University.isActive`.
- Added active/verified reference-data indexes.
- Added migration `20260716110000_reference_data_onboarding`.
- Added PostgreSQL validation and derived-location synchronization triggers.

## API Changes

- Added `PATCH /api/onboarding`.
- Updated `PUT /api/onboarding`.
- Added `GET /api/admin/reference-data/:type`.
- Added `POST /api/admin/reference-data/:type`.
- Added `PATCH /api/admin/reference-data/:type/:id`.
- Added `DELETE /api/admin/reference-data/:type/:id`.
- All Admin reference responses use explicit DTOs and private non-cacheable responses.

## UI/UX Changes

- Updated onboarding to restore existing values and save progress between steps.
- Updated the university selector dynamically when the study city changes.
- Added an exit path for members editing a completed onboarding profile.
- Added `/admin/reference-data` using the existing Admin design system.
- Added Reference data to permission-filtered Admin navigation.
- Preserved all five primary navigation destinations.

## Performance Improvements

- Added indexes for active country, city, and university onboarding/Admin queries.
- Bounded reference-data Admin lists to paginated queries.
- Reused a single normalized reference-data query boundary for onboarding.

## Security Improvements

- Enforced reference-data permissions on both server pages and APIs.
- Enforced origin checks and Zod validation on every reference mutation.
- Made every Admin reference mutation atomic with AuditLog.
- Added database-level protection against direct inconsistent location writes.
- Prevented raw Prisma records and dependency relations from entering API responses.

## Files Created

- `app/admin/reference-data/page.tsx`
- `app/api/admin/reference-data/[type]/route.ts`
- `app/api/admin/reference-data/[type]/[id]/route.ts`
- `prisma/migrations/20260716110000_reference_data_onboarding/migration.sql`
- `src/components/features/admin/ReferenceDataManager.tsx`
- `src/lib/onboarding.ts`
- `src/lib/reference-data.ts`
- `tests/integration/reference-data-postgres.test.ts`

## Files Modified

- `README.md`
- `app/(platform)/settings/page.tsx`
- `app/api/onboarding/route.ts`
- `app/onboarding/page.tsx`
- `package.json`
- `package-lock.json`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/components/features/admin/AdminNav.tsx`
- `src/components/onboarding/OnboardingFlow.tsx`
- `src/lib/authorization.ts`
- `src/lib/server-auth.ts`
- `src/lib/validation.ts`
- `tests/unit/authorization.test.ts`
- `tests/unit/validation.test.ts`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/COMPONENTS.md`
- `docs/DATABASE.md`
- `docs/DEPLOYMENT.md`
- `docs/ROADMAP.md`
- `docs/SECURITY.md`

## Files Removed

- None.

## Breaking Changes

- Migration `20260716110000_reference_data_onboarding` must be deployed before version 0.6.0.
- Existing inconsistent User study-city values are deterministically corrected to the selected University's city.
- Onboarding accepts only active origin countries, active Chinese study cities, and active verified universities.

## Migration Notes

- Back up production and run `npx prisma migrate deploy`.
- Review the affected-row counts for University country normalization and User study-city correction.
- The country selected on a User remains country of origin; it is intentionally not forced to equal the Chinese study city's country.
- Existing Admin and Super Admin accounts automatically receive reference-data permissions through the code permission matrix.

## Next Recommended Tasks

- Implement Module 5 media and files using provider-neutral storage contracts.
- Add signed uploads, MIME/extension/size/dimension/decode checks, ownership, secure delivery, replacement/deletion, orphan cleanup, alt text, and Admin inspection.
- Keep video, social galleries, and image editing outside Module 5.

# Version 0.7.0

Date:
2026-07-16

## Summary

Implemented Module 5 as a provider-neutral, signed, server-validated media foundation with secure delivery, ownership, replacement/removal, orphan cleanup, accessible alt text, and audited Admin inspection.

## Features Added

- Added short-lived signed upload authorizations bound to owner, asset, generated key, MIME, exact byte count, and expiry.
- Added private local development storage and private S3-compatible production storage behind one interface.
- Added two-phase upload activation with server read-back, magic MIME detection, extension matching, size validation, image decoding/frame/dimension checks, constrained PDF validation, content-safety markers, and SHA-256 checksums.
- Added public/private secure delivery through stable media IDs without exposing provider object keys.
- Added immutable media replacement, owner removal, alt-text updates, attachment identity, and provider-deletion retry state.
- Added scheduled cleanup for expired authorizations, stale unattached media, and failed provider deletions.
- Added paginated/filterable Admin media inventory, detail inspection, secure preview, audit timeline, and reasoned removal.
- Added PostgreSQL integration coverage for ownership, privacy, rejection, replacement, concurrency, cleanup, and audit rollback.

## Features Modified

- Extended the permission matrix with `MEDIA_VIEW` and `MEDIA_MANAGE` for Admin and Super Admin only.
- Extended permission-filtered Admin navigation with the Media workspace.
- Extended package scripts with `npm run media:cleanup`.
- Extended validation with media intent, alt-text, and Admin removal schemas.

## Bugs Fixed

- Prevented clients from choosing or discovering provider object keys.
- Prevented MIME spoofing, extension mismatch, truncated/undecodable media, invalid dimensions, multi-frame images, and unsafe constrained PDFs from becoming deliverable.
- Prevented unauthorized access to private media and normalized unauthorized delivery to `404`.
- Prevented concurrent completion and concurrent replacement attempts from activating duplicate versions.
- Prevented a failed mandatory Admin audit insert from leaving the media removed.
- Prevented failed physical deletion from losing cleanup work or audit metadata.

## Database Changes

- Added `MediaKind`, `MediaPurpose`, `MediaVisibility`, `MediaStatus`, `MediaScanStatus`, and `MediaStorageProvider` enums.
- Added the `MediaAsset` table with owner/remover/replacement relations.
- Added lifecycle, active-validation, size, and image-dimension check constraints.
- Added indexes for owner/status, upload expiry, orphan cleanup, purpose/status, scan/status, replacement lineage, and attachment identity.
- Added Prisma migration `20260716130000_secure_media`.
- No existing table or legacy media-key column was removed.

## API Changes

- Added `POST /api/media/uploads`.
- Added signed local-development `PUT /api/media/uploads/:id/content`.
- Added `POST /api/media/uploads/:id/complete`.
- Added secure `GET /api/media/:id`.
- Added owner `PATCH /api/media/:id` for alt text.
- Added owner `DELETE /api/media/:id`.
- Added `GET /api/admin/media`.
- Added `GET /api/admin/media/:id`.
- Added Admin `DELETE /api/admin/media/:id`.
- No endpoint was removed.

## UI/UX Changes

- Added the reusable `MediaImage` renderer for stable secure media URLs.
- Added responsive Admin media inventory and detail pages.
- Added safe active-image previews and forced-download document delivery.
- Added clear status, validation, ownership, attachment, removal, and storage-cleanup indicators.
- Preserved the existing application layout and all five bottom-navigation destinations.

## Performance Improvements

- Added targeted PostgreSQL indexes for media lifecycle and cleanup queries.
- Kept browser uploads direct to S3-compatible storage in production through presigned writes.
- Used immutable generated object keys so replacement does not require overwriting or cache invalidation.
- Used Next Image rendering for public images and bounded Admin pagination.

## Security Improvements

- Kept storage private and rejected local filesystem storage in production.
- Validated stored bytes instead of trusting client or provider metadata.
- Required `ACTIVE/CLEAN` lifecycle state before any delivery.
- Enforced owner, conversation-participant-ready, and exact Admin permission checks on private delivery.
- Hid object keys from member and Admin DTOs.
- Audited media lifecycle changes and made Admin removal atomic with AuditLog.
- Added content-disposition, CSP sandbox, MIME-sniff prevention, and private/no-store headers where required.
- Added rate limits for upload authorization and completion.

## Files Created

- `app/admin/media/page.tsx`
- `app/admin/media/[id]/page.tsx`
- `app/api/admin/media/route.ts`
- `app/api/admin/media/[id]/route.ts`
- `app/api/media/[id]/route.ts`
- `app/api/media/uploads/route.ts`
- `app/api/media/uploads/[id]/content/route.ts`
- `app/api/media/uploads/[id]/complete/route.ts`
- `prisma/migrations/20260716130000_secure_media/migration.sql`
- `scripts/cleanup-media.ts`
- `src/components/features/admin/MediaAdminActions.tsx`
- `src/components/ui/MediaImage.tsx`
- `src/lib/media-policy.ts`
- `src/lib/media-token.ts`
- `src/lib/media-validation.ts`
- `src/lib/media.ts`
- `src/lib/storage.ts`
- `tests/integration/media-postgres.test.ts`
- `tests/unit/media-security.test.ts`

## Files Modified

- `.env.example`
- `package.json`
- `package-lock.json`
- `prisma/schema.prisma`
- `src/components/features/admin/AdminNav.tsx`
- `src/lib/authorization.ts`
- `src/lib/validation.ts`
- `tests/unit/authorization.test.ts`
- `tests/unit/validation.test.ts`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/COMPONENTS.md`
- `docs/DATABASE.md`
- `docs/DEPLOYMENT.md`
- `docs/ROADMAP.md`
- `docs/SECURITY.md`

## Files Removed

- None.

## Breaking Changes

- Migration `20260716130000_secure_media` must be deployed before version 0.7.0 handles media requests.
- Production must configure `STORAGE_DRIVER=s3`; the local driver intentionally throws in production.
- Storage buckets must remain private and permit only the reviewed presigned upload origins/headers.

## Migration Notes

- Back up production and run `npx prisma migrate deploy`.
- Configure `STORAGE_DRIVER`, bucket, region, endpoint when applicable, and least-privilege storage credentials before deploying the application build.
- Configure exact-origin CORS for presigned `PUT` requests; do not enable public bucket reads.
- Schedule `npm run media:cleanup` at least hourly and monitor non-zero failures.
- Existing `User.avatarKey`, community/post/listing/guide/message media fields remain unchanged. Their domain modules will adopt and attach validated `MediaAsset` records without a destructive migration in this module.
- The constrained document policy supports PDF only. Video, SVG, GIF animation, office documents, image editing, and social galleries remain out of scope.

## Next Recommended Tasks

- Implement Module 6 profile editing and attach validated `PROFILE_AVATAR` media atomically.
- Define public/private profile visibility preferences and stable DTOs.
- Add profile saved-content, export/deletion requests, block/report entry points, and Admin profile review.

# Version 0.8.0

Date:
2026-07-16

## Summary

Implemented Module 6 as a privacy-aware profile foundation with member editing, validated avatars, stable audience-filtered DTOs, coherent visible activity and counters, saved content, profile safety actions, account requests, and audited Admin review.

## Features Added

- Added owner profile editing for identity, biography, study context, languages, contact fields, and independent visibility groups.
- Added validated private profile-avatar upload, attachment, replacement, removal, alt text, and secure audience-aware delivery through Module 5.
- Added a stable versioned profile DTO for anonymous, member, owner, and authorized Admin viewers.
- Added visibility-consistent profile communities, activity, marketplace entries, saved content, and counters.
- Added profile block/unblock and active-report reuse with preserved profile evidence.
- Added data-export and account-deletion request creation, reuse, cancellation, versioned processing, completion, and rejection.
- Added searchable paginated Admin user review, safe user detail, account-request operations, and bounded audit history.
- Added retained-media evidence handling so a reported avatar remains reviewable after replacement without becoming publicly deliverable.
- Added PostgreSQL integration coverage for profile privacy, avatars, reports, retention, account requests, concurrency, and audit rollback.

## Features Modified

- Extended the permission matrix with `USER_VIEW` and `ACCOUNT_REQUEST_MANAGE` for Admin and Super Admin only.
- Extended the Admin navigation with the Users workspace.
- Extended moderation evidence serialization with role-scoped profile snapshots.
- Extended the application shell and shared Avatar renderer to use validated profile media.
- Extended Settings with direct access to profile and identity editing.
- Extended current-user serialization with the safe avatar media identifier.

## Bugs Fixed

- Prevented hidden profile sections from leaking through aggregate counts or activity lists.
- Prevented public profile APIs from exposing email, phone, role, account status, sessions, OAuth data, or internal timestamps.
- Prevented attaching another member's media or an invalid/non-avatar asset as a profile avatar.
- Prevented concurrent or duplicate active profile reports and account requests.
- Prevented replaced reported avatars from being physically deleted before authorized evidence review.
- Prevented Moderators and members from accessing private Admin user/account-request data.
- Prevented a failed mandatory audit insert from leaving a profile, report, block, or account-request mutation committed.

## Database Changes

- Added `ProfileAudience`, `AccountRequestType`, and `AccountRequestStatus` enums.
- Added independent profile, location, education, language, community, activity, and marketplace audience fields to `User`.
- Added the unique `User.avatarMediaId` relation to validated `MediaAsset`.
- Added the versioned `AccountRequest` table and operational indexes.
- Added `PROFILE_SNAPSHOT` report evidence.
- Added partial unique indexes for active profile reports and active member request types.
- Added `MediaAsset.retainedAt` and `retentionReason` with an operational retention index.
- Added Prisma migrations `20260716160000_profiles` and `20260716161000_profile_media_retention`.

## API Changes

- Added `GET` and `PATCH /api/profile`.
- Added `GET /api/profiles/:id`.
- Added `POST /api/profiles/:id/report`.
- Added `GET` and `POST /api/account/requests`.
- Added `DELETE /api/account/requests/:id`.
- Added `GET /api/admin/users`.
- Added `GET /api/admin/users/:id`.
- Added `PATCH /api/admin/account-requests/:id`.
- Updated secure media delivery to authorize attached profile avatars and retained evidence.
- No endpoint was removed.

## UI/UX Changes

- Added responsive owner profile editing with avatar preview, upload, replacement, removal, and visibility selectors.
- Added stable owner/member profile views with visible activity, marketplace, communities, and saved-content tabs.
- Added block and report controls on another member's profile.
- Added export/deletion request controls to profile settings.
- Added responsive Admin user inventory and detail pages with account-request actions.
- Added validated avatar rendering to the authenticated application shell.
- Preserved the existing design system, responsive shell, routing structure, and five bottom-navigation destinations.

## Performance Improvements

- Used explicit bounded Prisma selections for profile and Admin DTOs.
- Computed profile counts from the same filtered query boundaries used for visible records.
- Added indexes for account-request queues, retained media, and active profile-report deduplication.
- Kept saved content within existing shared visibility resolvers instead of introducing duplicate read systems.

## Security Improvements

- Defaulted every migrated profile audience to authenticated members rather than anonymous public access.
- Enforced whole-profile and field-group audiences on the server.
- Kept profile avatars private in storage and authorized every delivery through the owning profile.
- Preserved immutable bounded profile-report evidence while masking stable identifiers by staff role.
- Restricted user review and account-request processing to exact Admin/Super Admin permissions.
- Added optimistic versions, transactional AuditLogs, same-origin checks, validation, and generic controlled API failures.
- Kept raw Prisma objects, media keys, password/session data, and private evidence out of API responses.

## Files Created

- `app/(platform)/profile/edit/page.tsx`
- `app/admin/users/page.tsx`
- `app/admin/users/[id]/page.tsx`
- `app/api/profile/route.ts`
- `app/api/profiles/[id]/route.ts`
- `app/api/profiles/[id]/report/route.ts`
- `app/api/account/requests/route.ts`
- `app/api/account/requests/[id]/route.ts`
- `app/api/admin/users/route.ts`
- `app/api/admin/users/[id]/route.ts`
- `app/api/admin/account-requests/[id]/route.ts`
- `prisma/migrations/20260716160000_profiles/migration.sql`
- `prisma/migrations/20260716161000_profile_media_retention/migration.sql`
- `src/components/features/admin/AccountRequestActions.tsx`
- `src/components/features/profile/AccountRequestPanel.tsx`
- `src/components/features/profile/ProfileEditor.tsx`
- `src/components/features/profile/ProfileSafetyActions.tsx`
- `src/components/features/profile/ProfileView.tsx`
- `src/lib/profiles.ts`
- `tests/integration/profiles-postgres.test.ts`
- `tests/unit/profiles.test.ts`

## Files Modified

- `package.json`
- `package-lock.json`
- `prisma/schema.prisma`
- `app/(platform)/profile/page.tsx`
- `app/(platform)/profile/[username]/page.tsx`
- `app/(platform)/settings/page.tsx`
- `app/admin/media/[id]/page.tsx`
- `app/admin/reports/[id]/page.tsx`
- `src/components/app/AppShell.tsx`
- `src/components/features/admin/AdminNav.tsx`
- `src/components/ui/Avatar.tsx`
- `src/lib/authorization.ts`
- `src/lib/media-policy.ts`
- `src/lib/media.ts`
- `src/lib/moderation.ts`
- `src/lib/serializers.ts`
- `src/lib/server-auth.ts`
- `src/lib/validation.ts`
- `tests/integration/media-postgres.test.ts`
- `tests/unit/authorization.test.ts`
- `tests/unit/validation.test.ts`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/COMPONENTS.md`
- `docs/DATABASE.md`
- `docs/DEPLOYMENT.md`
- `docs/ROADMAP.md`
- `docs/SECURITY.md`

## Files Removed

- None.

## Breaking Changes

- Migrations `20260716160000_profiles` and `20260716161000_profile_media_retention` must be deployed before version 0.8.0 handles profile editing, profile evidence, or account requests.
- Profile avatars now use validated `MediaAsset` IDs and private authorized delivery; legacy `avatarKey` remains stored but is no longer the active profile-rendering contract.

## Migration Notes

- Back up production and run `npx prisma migrate deploy`.
- Existing members receive `MEMBERS` for every new audience preference; the migration does not make profiles anonymously public.
- Do not physically purge media where `retainedAt` is set. It may be required as preserved moderation evidence after the member replaces or removes the avatar.
- Account-request completion records operational review only. Automated export generation, reauthentication, legal holds, and irreversible deletion execution remain later account-lifecycle work.
- Existing profile routes remain stable. No friend, follower, reputation, or badge system was introduced.

## Next Recommended Tasks

- Implement Module 7 Settings with persisted Light/Dark/System, privacy, sessions, notification preferences, and language.
- Reuse Module 6 account requests from Settings instead of creating a parallel export/deletion workflow.
- Keep complete translation, automated export generation, and irreversible account deletion outside Module 7.

# Version 0.9.0

Date:
2026-07-16

## Summary

Implemented Module 7 as a complete persisted Settings foundation covering appearance, privacy, language intent, notification preferences, sessions and devices, logout, and reused account export/deletion requests.

## Features Added

- Added dedicated responsive Settings pages for Appearance, Privacy, Notification preferences, Language, Sessions & devices, and Account.
- Added persisted Light, Dark, and System appearance preferences synchronized with the authenticated application shell.
- Added persisted English, French, Chinese, and Arabic language intent with an explicit incomplete-translation state.
- Added persisted notification category toggles and email-digest frequency for the upcoming shared notification service.
- Added safe active-session listing with derived device labels and current-device identification.
- Added targeted session revocation, sign-out of other devices, sign-out everywhere, and explicit current-device logout.
- Added PostgreSQL integration coverage for settings defaults/persistence, safe session DTOs, ownership, revocation, and audit rollback.

## Features Modified

- Extended the authenticated shell to load saved theme preference and persist header Light/Dark changes.
- Reorganized the existing Settings landing page into complete settings destinations without changing primary navigation.
- Replaced the language placeholder with a persisted preference interface while preserving `/language`.
- Reused Module 6 profile audiences for privacy and Module 6 account requests for export/deletion.
- Extended current-user selection with the safe persisted theme/language relation.

## Bugs Fixed

- Prevented appearance selection from being limited to one browser's local state.
- Prevented Settings from linking notification preferences to the notification inbox as if they were the same function.
- Added the missing member-facing UI for database session review and revocation.
- Prevented session-management responses from exposing token hashes, raw IP addresses, or raw user-agent strings.
- Prevented a member from revoking a session owned by another account.
- Prevented failed mandatory AuditLog inserts from leaving preference or session mutations committed.

## Database Changes

- Added `ThemePreference`, `AppLanguage`, and `NotificationDigest` enums.
- Added the one-to-one `UserPreference` table for appearance, language, notification categories, and digest frequency.
- Added an email-digest/update-time index for future asynchronous notification processing.
- Added Prisma migration `20260716170000_settings_preferences`.
- Existing users require no backfill because missing rows resolve to safe defaults and are created on first mutation.

## API Changes

- Added `GET /api/settings`.
- Added `PATCH /api/settings`.
- Added `GET /api/settings/sessions`.
- Added bulk `DELETE /api/settings/sessions` for other-device or all-device revocation.
- Added `DELETE /api/settings/sessions/:id`.
- Updated the authenticated shell to persist compact header theme changes through `/api/settings`.
- No endpoint was removed.

## UI/UX Changes

- Added accessible Light, Dark, and System selection with immediate visual application and persistence feedback.
- Added field-group privacy selectors in Settings while preserving the existing profile editor.
- Added notification-category and digest controls separate from the notification inbox.
- Added language preference cards that clearly distinguish stored intent from complete translation.
- Added device cards, current-session markers, expiry information, refresh, revoke, and global sign-out controls.
- Added explicit logout plus export/deletion controls under Account.
- Preserved the existing design system, application shell, responsive behavior, and five bottom-navigation destinations.

## Performance Improvements

- Used a single one-to-one preference row rather than separate per-setting tables.
- Resolved missing preferences from in-process defaults without write-on-read backfills.
- Updated only the current session timestamp when the sessions screen is opened.
- Kept session lists bounded to the current member's non-expired rows and sorted by recent activity.

## Security Improvements

- Required an active database session and trusted same origin for every settings/session mutation.
- Audited preference writes and all session revocations atomically.
- Cleared the host-only session cookie when the current or all sessions are revoked.
- Returned only opaque session row IDs, derived device labels, current state, and timestamps.
- Rechecked session ownership on the server and normalized foreign/missing sessions to `404`.
- Kept notification preferences declarative until Module 8 centrally enforces them across producers.

## Files Created

- `app/(platform)/settings/appearance/page.tsx`
- `app/(platform)/settings/privacy/page.tsx`
- `app/(platform)/settings/notifications/page.tsx`
- `app/(platform)/settings/language/page.tsx`
- `app/(platform)/settings/sessions/page.tsx`
- `app/(platform)/settings/account/page.tsx`
- `app/api/settings/route.ts`
- `app/api/settings/sessions/route.ts`
- `app/api/settings/sessions/[id]/route.ts`
- `prisma/migrations/20260716170000_settings_preferences/migration.sql`
- `src/components/features/settings/AppearanceSettings.tsx`
- `src/components/features/settings/PrivacySettings.tsx`
- `src/components/features/settings/NotificationSettings.tsx`
- `src/components/features/settings/LanguageSettings.tsx`
- `src/components/features/settings/SessionsPanel.tsx`
- `src/components/features/settings/LogoutButton.tsx`
- `src/lib/settings.ts`
- `tests/integration/settings-postgres.test.ts`

## Files Modified

- `package.json`
- `package-lock.json`
- `prisma/schema.prisma`
- `app/(platform)/settings/page.tsx`
- `app/(platform)/language/page.tsx`
- `src/components/app/AppShell.tsx`
- `src/lib/server-auth.ts`
- `src/lib/validation.ts`
- `tests/unit/validation.test.ts`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/COMPONENTS.md`
- `docs/DATABASE.md`
- `docs/DEPLOYMENT.md`
- `docs/ROADMAP.md`
- `docs/SECURITY.md`

## Files Removed

- None.

## Breaking Changes

- Migration `20260716170000_settings_preferences` must be deployed before version 0.9.0 serves persisted Settings.
- No route or primary-navigation destination was removed or renamed.

## Migration Notes

- Back up production and run `npx prisma migrate deploy`.
- Existing users do not need a data backfill. Until their first mutation, the application returns `SYSTEM`, `ENGLISH`, enabled in-app categories, and `NEVER` email digest.
- French, Chinese, and Arabic selections store language intent only; the product remains English until Module 20's reviewed translation workflow is complete.
- Notification preferences are persisted but become enforced producer policy in Module 8.
- Session revocation deletes the hashed session row immediately while preserving the operation in AuditLog.

## Next Recommended Tasks

- Implement Module 8's shared notification service and make every producer respect these persisted preferences.
- Add individual click-to-read, hiding/removal, pagination, real unread counts, templates, deduplication, safe links, and asynchronous delivery.
- Add Admin notification templates, announcements, and diagnostics without introducing advanced marketing campaigns.

# Version 0.10.0

Date:
2026-07-16

## Summary

Implemented Module 8 as a shared asynchronous notification system with PostgreSQL outbox jobs, preferences, safe links, templates, deduplication, retries, member controls, real counters, producers, and Admin operations.

## Features Added

- Added deduplicated transactional notification outbox jobs and a bounded asynchronous worker.
- Added safe internal-link validation, fixed-key templates, bounded variables, retry states, stale-lock recovery, and preference enforcement.
- Added individual click-to-read, mark-all-read, soft hiding, pagination, real unread counts, and the shell badge.
- Added live producers for Messages, Q&A replies, Marketplace contacts, and moderation results plus the shared Comment producer contract.
- Added Admin template editing, product announcements, delivery diagnostics, permissions, rate limits, and atomic audit.
- Added script and secret-authenticated endpoint processing plus PostgreSQL concurrency, retry, preference, safety, and rollback tests.

## Features Modified

- Replaced synchronous Message notification writes with transactional outbox enqueueing.
- Made Q&A answer creation, audit, and notification enqueue atomic.
- Added Marketplace source context to seller-contact conversations.
- Added moderation-result notification enqueueing to terminal report transitions.
- Made persisted Module 7 notification preferences executable.
- Replaced the static header indicator with the real unread count.

## Bugs Fixed

- Prevented duplicate notifications under concurrent enqueueing or workers.
- Fixed Prisma concurrent-upsert `P2002` by using `createMany(skipDuplicates)` plus stable lookup.
- Split the PostgreSQL enum migration so the new moderation value is committed before template insertion.
- Prevented unsafe external, Admin, traversal, backslash, and control-character notification links.
- Prevented preferences from suppressing mandatory moderation results.
- Prevented worker crashes from leaving permanent processing locks.
- Prevented Admin diagnostics from exposing recipients, payload data, email addresses, or raw errors.

## Database Changes

- Added `MODERATION_UPDATE`, `NotificationJobStatus`, and `NotificationAnnouncementStatus`.
- Added template, announcement, and notification-job tables and relations.
- Added notification template/dedupe/job data plus soft-hidden state.
- Added uniqueness and operational queue, read, hide, announcement, and diagnostic indexes.
- Seeded six reviewed fixed-key templates.
- Added migrations `20260716185000_notification_type_moderation` and `20260716190000_notification_foundation`.

## API Changes

- Added `GET /api/notifications`.
- Added `GET /api/notifications/unread-count`.
- Added `PATCH /api/notifications/:id/read`.
- Added `DELETE /api/notifications/:id`.
- Updated `PATCH /api/notifications/read-all`.
- Added `GET|POST /api/admin/notifications`.
- Added `PATCH /api/admin/notifications/templates/:key`.
- Added secret-authenticated `POST /api/internal/notifications/process`.
- Extended first-message payloads with validated optional Marketplace source context.

## UI/UX Changes

- Added paginated notification rows with actor avatars, optimistic read state, safe navigation, and hide controls.
- Added real total/unread counts, empty states, Previous/Next controls, and shell badge values.
- Added responsive Admin notification counters, template forms, announcement composer, recent announcements, and job diagnostics.
- Preserved the application design, responsive shell, and five bottom-navigation destinations.

## Performance Improvements

- Moved rendering/fan-out out of source request latency.
- Added bounded batches, three-attempt retry limits, stale-lock recovery, indexed queue selection, and database-level deduplication.
- Kept the modular-monolith worker replaceable without changing producer contracts.

## Security Improvements

- Validated links at enqueue and serialization.
- Enforced preferences at delivery time while preserving mandatory safety updates.
- Used a separate worker secret with timing-safe comparison.
- Restricted notification Admin to Admin/Super Admin with exact permissions, trusted origin, rate limits, optimistic versions, and audit.
- Returned explicit member/Admin DTOs without jobs, dedupe keys, data payloads, recipient metadata, or raw failures.

## Files Created

- `app/admin/notifications/page.tsx`
- `app/api/admin/notifications/route.ts`
- `app/api/admin/notifications/templates/[key]/route.ts`
- `app/api/internal/notifications/process/route.ts`
- `app/api/notifications/route.ts`
- `app/api/notifications/unread-count/route.ts`
- `app/api/notifications/[id]/route.ts`
- `app/api/notifications/[id]/read/route.ts`
- `prisma/migrations/20260716185000_notification_type_moderation/migration.sql`
- `prisma/migrations/20260716190000_notification_foundation/migration.sql`
- `scripts/process-notifications.ts`
- `src/components/features/admin/NotificationAdminPanel.tsx`
- `src/components/features/notifications/NotificationItem.tsx`
- `src/lib/notifications.ts`
- `tests/integration/notifications-postgres.test.ts`
- `tests/unit/notifications.test.ts`

## Files Modified

- `.env.example`
- `package.json`
- `package-lock.json`
- `prisma/schema.prisma`
- `app/(platform)/layout.tsx`
- `app/(platform)/marketplace/[slug]/page.tsx`
- `app/(platform)/messages/new/page.tsx`
- `app/(platform)/notifications/page.tsx`
- `app/admin/layout.tsx`
- `app/api/notifications/read-all/route.ts`
- `app/api/questions/[id]/answers/route.ts`
- `src/components/app/AppShell.tsx`
- `src/components/features/admin/AdminNav.tsx`
- `src/components/features/messages/MessageComposer.tsx`
- `src/components/features/messages/MessageUserButton.tsx`
- `src/components/features/notifications/MarkAllReadButton.tsx`
- `src/lib/authorization.ts`
- `src/lib/messaging.ts`
- `src/lib/moderation.ts`
- `src/lib/platform-queries.ts`
- `src/lib/validation.ts`
- `tests/unit/authorization.test.ts`
- `tests/unit/validation.test.ts`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/COMPONENTS.md`
- `docs/DATABASE.md`
- `docs/DEPLOYMENT.md`
- `docs/ROADMAP.md`
- `docs/SECURITY.md`

## Files Removed

- None.

## Breaking Changes

- Migrations `20260716185000_notification_type_moderation` and `20260716190000_notification_foundation` must be deployed in order before version 0.10.0 processes notification jobs.
- Production notification delivery now requires a scheduled worker and `NOTIFICATION_WORKER_SECRET`.

## Migration Notes

- Back up production and run `npx prisma migrate deploy`.
- Do not merge the two notification migrations: PostgreSQL requires the enum value to commit before the second migration uses it.
- Configure a separate long `NOTIFICATION_WORKER_SECRET` and invoke the worker at least once per minute.
- Run locally with `npm run notifications:process`; monitor pending age, failed jobs, retries, and stale-lock recovery.
- Email digest delivery remains stored preference only until an approved email provider and consent policy exist.
- Comment delivery is wired as a shared producer contract and becomes live with Module 11's actual Comment CRUD.

## Next Recommended Tasks

- Implement Module 9 shell/navigation completion without changing the five destinations.
- Add the real Messages unread counter, accessible Search shortcut, logout access, exact Admin visibility, and route loading/error/not-found states.
- Remove remaining static shell indicators while preserving the current design.

# Version 0.11.0

Date:
2026-07-16

## Summary

Completed Module 9 shell/navigation refinement with real counters, logout access, Search shortcut, accessible mobile behavior, exact Admin visibility, and shared route states.

## Features Added

- Added one-query PostgreSQL direct-message unread counting.
- Added real Messages badges beside the real Notifications badge.
- Added Command/Ctrl+K Search navigation.
- Added desktop and mobile shell logout.
- Added platform loading, retryable error, and not-found boundaries.

## Features Modified

- Derived Admin visibility from the shared permission matrix.
- Added Escape-close and dialog semantics to mobile navigation.
- Loaded both shell counters in parallel.

## Bugs Fixed

- Removed the remaining static shell indicator.
- Prevented stale hardcoded role lists from controlling Admin visibility.
- Prevented unread message counts from requiring inbox N+1 queries.

## Database Changes

- None.

## API Changes

- No endpoint added or removed.
- Reused `POST /api/auth/logout` and existing server reads.

## UI/UX Changes

- Added compact `99+` badges on desktop and mobile.
- Added accessible logout and Search keyboard behavior.
- Added consistent protected-route fallback states.
- Preserved all five navigation destinations and the existing design.

## Performance Improvements

- Added one aggregate SQL query for the global Messages unread count.
- Loaded Messages and Notifications counts concurrently.

## Security Improvements

- Reused database-backed logout and permission checks.
- Kept route errors generic and not-found states non-disclosing.

## Files Created

- `app/(platform)/loading.tsx`
- `app/(platform)/error.tsx`
- `app/(platform)/not-found.tsx`

## Files Modified

- `package.json`
- `package-lock.json`
- `app/(platform)/layout.tsx`
- `app/admin/layout.tsx`
- `src/components/app/AppShell.tsx`
- `src/lib/messaging.ts`
- `tests/integration/notifications-postgres.test.ts`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/COMPONENTS.md`
- `docs/DEPLOYMENT.md`
- `docs/ROADMAP.md`

## Files Removed

- None.

## Breaking Changes

- None.

## Migration Notes

- No migration is required.
- Verify keyboard shortcuts do not conflict with browser/assistive-technology policy in the target environment.

## Next Recommended Tasks

- Implement Module 10 Messages and safety completion.
- Preserve direct-message philosophy and the five primary destinations.

# Version 0.12.0

Date:
2026-07-16

## Summary

Completed Module 10 Messages and safety with paginated direct conversations, reliable unread/read state, participant-local archive and delete-for-me retention, validated private image/PDF attachments, PostgreSQL DIRECT cardinality guarantees, asynchronous notifications, preserved report evidence, and privacy-bounded Admin safety operations.

## Features Added

- Added database-backed inbox pagination, history pagination, archive filtering, and server-side conversation/message search.
- Added participant archive/restore and delete-for-me workflows.
- Added explicit message-position read updates and reliable unread aggregates.
- Added validated JPG, PNG, WebP, and PDF message attachments through Module 5.
- Added Admin/Super Admin message-safety metrics and safe report handoff.
- Added PostgreSQL integration coverage for the complete messaging/safety lifecycle.

## Features Modified

- Reworked direct-message persistence around safe DTOs and one transactional message/media/notification boundary.
- Updated new and existing conversation composers to accept text, one attachment, or both.
- Updated new incoming messages to restore archived/hidden inbox entries while preserving the participant's prior clear boundary.
- Updated the conversation menu with archive, restore, delete-for-me, block, unblock, and report actions.
- Updated inbox and history pages with bounded pagination and protected attachment rendering.

## Bugs Fixed

- Removed the inbox unread-count N+1 query pattern.
- Prevented opening a conversation from marking messages later than the newest message actually displayed.
- Prevented a third or non-canonical participant from entering a DIRECT conversation.
- Prevented physical user deletion from leaving a one-participant DIRECT thread.
- Prevented deleted-for-me history from reappearing when a later message restores the conversation.
- Prevented raw Prisma message/media records and provider object keys from reaching member or Admin safety responses.

## Database Changes

- Added `ConversationParticipant.clearedAt` and `ConversationParticipant.deletedAt`.
- Added unique `Message.mediaId` and the `MessageMedia` relation to `MediaAsset`.
- Added participant inbox-state and message-media indexes.
- Added message-content integrity validation.
- Added canonical participant, maximum-cardinality, deferred completion, and physical-deletion cleanup triggers for DIRECT conversations.
- Added migration `20260716210000_messages_safety`.

## API Changes

- Updated `POST /api/messages` to accept validated optional `mediaId`.
- Updated `POST /api/conversations/:id/messages` to accept text/media payloads and return a safe DTO.
- Updated `PATCH /api/conversations/:id/read` to require a validated `latestMessageId`.
- Added `PATCH /api/conversations/:id` for archive/restore.
- Added `DELETE /api/conversations/:id` for participant-local delete-for-me.
- Added `GET /api/admin/message-safety` for aggregate privacy-bounded operations data.

## UI/UX Changes

- Added Inbox and Archived views with database-backed search and pagination.
- Added Older/Newer history navigation.
- Added image/PDF attachment selection, accessible image description, upload progress, protected image rendering, PDF download, and unavailable-media state.
- Added archive/restore and delete-for-me conversation controls.
- Added a responsive Message safety Admin page with explicit private-conversation boundaries.
- Preserved the existing design system and all five bottom-navigation destinations.

## Performance Improvements

- Replaced per-conversation unread queries with one aggregate query for each inbox page.
- Bounded inbox pages to 20 records and history pages to 50 records by default.
- Kept message notifications outside user-facing delivery latency through the existing PostgreSQL outbox.
- Selected explicit message/media fields and returned stable DTOs.

## Security Improvements

- Enforced exactly two canonical DIRECT participants with migration-managed database triggers.
- Required active, clean, owned `MESSAGE_IMAGE` or `MESSAGE_DOCUMENT` media before atomic attachment.
- Kept private media delivery limited to the owner, conversation participants, or exact media operations permission.
- Preserved shared messages, media metadata, and immutable report evidence when one participant deletes history for themselves.
- Restricted message-safety administration to Admin/Super Admin and intentionally omitted raw conversation access.
- Preserved Moderator/Admin/Super Admin evidence redaction through the existing report workflow.

## Files Created

- `app/admin/message-safety/page.tsx`
- `app/api/admin/message-safety/route.ts`
- `app/api/conversations/[id]/route.ts`
- `prisma/migrations/20260716210000_messages_safety/migration.sql`
- `tests/integration/messaging-postgres.test.ts`

## Files Modified

- `package.json`
- `package-lock.json`
- `prisma/schema.prisma`
- `app/(platform)/messages/page.tsx`
- `app/(platform)/messages/[id]/page.tsx`
- `app/api/conversations/[id]/messages/route.ts`
- `app/api/conversations/[id]/read/route.ts`
- `src/components/features/admin/AdminNav.tsx`
- `src/components/features/messages/ConversationActions.tsx`
- `src/components/features/messages/MarkConversationRead.tsx`
- `src/components/features/messages/MessageComposer.tsx`
- `src/lib/authorization.ts`
- `src/lib/messaging.ts`
- `src/lib/validation.ts`
- `tests/unit/validation.test.ts`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/COMPONENTS.md`
- `docs/DATABASE.md`
- `docs/DEPLOYMENT.md`
- `docs/ROADMAP.md`
- `docs/SECURITY.md`

## Files Removed

- None.

## Breaking Changes

- Migration `20260716210000_messages_safety` must be deployed before version 0.12.0 sends attachments or operates participant clear/delete state.
- The migration aborts when it finds a non-empty legacy DIRECT conversation that is not exactly two canonical participants.
- Message read requests now require `latestMessageId`; older clients sending an empty PATCH body receive `400`.

## Migration Notes

- Back up production and run a preflight query confirming two participants and a sorted `directKey` for every DIRECT conversation.
- Run `npx prisma migrate deploy` before deploying the application build.
- Empty legacy DIRECT shells with no participant and no message are removed automatically.
- Do not delete `MediaAsset` metadata referenced by a live message. Owner/Admin removal is a soft lifecycle transition and retains safe message metadata.
- Configure private-bucket CORS for application-origin presigned PUT requests and keep `npm run media:cleanup` scheduled.
- Delete-for-me is not legal erasure; it is a participant-local visibility action. Account-deletion/export processing remains the Module 6 operational workflow.

## Next Recommended Tasks

- Implement Module 11 Communities, Posts, Comments, and Events.
- Reuse the Module 8 Comment notification producer and Module 5 media foundation.
- Preserve current messaging, report evidence, permission, and five-destination navigation contracts.

# Version 0.13.0

Date:
2026-07-16

## Summary

Completed Module 11 Communities, Posts, Comments, and Events with reviewed community CRUD, atomic ownership, scoped member roles, open/request/invitation access, complete post/comment operations, validated events, public media, content reports, asynchronous notifications, pagination, local operations, and Admin CMS.

## Features Added

- Added reviewed community creation, editing, archival, cover media, ownership transfer, invitations, join requests, access decisions, role management, and member removal.
- Added discussion, question, event, and staff announcement creation with edit/remove/moderation lifecycles.
- Added member-event validation, pin/unpin, publish, remove, restore, and operational moderation tools.
- Added threaded comment creation/reply/edit/remove, helpful reactions, reporting, and transactional comment notifications.
- Added Community/Post/Comment report evidence, active-case reuse, media retention, and role-redacted Admin review.
- Added responsive Community management and Admin/Super Admin Community CMS pages.
- Added PostgreSQL integration tests for ownership, access, content, media, notifications, reports, Admin permissions, concurrency, and atomic rollback.

## Features Modified

- Updated community visibility to include active public communities, memberships, and exact pending invitation access while excluding removed records.
- Updated community discovery with search, type/member filters, pagination, pending-access state, covers, and creation entry.
- Updated feeds and community detail with validated post images, post actions, event/announcement composition, comments, reports, and staff management.
- Activated the existing Module 8 comment producer and added announcement/event-approval/access notification producers.
- Updated the seed to create valid owner references and one OWNER membership per community.

## Bugs Fixed

- Prevented owner demotion/removal and multi-owner community state at the PostgreSQL layer.
- Corrected ownership transfer ordering so database invariants remain valid throughout the transaction.
- Allowed pending invitees to open private invitation-only communities and accept their invitation.
- Prevented unvalidated member events from appearing as published.
- Prevented duplicate active Community/Post/Comment reports under concurrent creation.
- Prevented raw Prisma records, provider object keys, internal report notes, or unauthorized evidence identity from reaching member/Admin APIs.

## Database Changes

- Added `CommunityStatus`, `CommunityJoinPolicy`, `CommunityAccessType`, and `CommunityAccessStatus`.
- Added `CommunityAccessRequest` and `PostMedia`.
- Added required community owner, cover media, lifecycle/moderation timestamps, event end/capacity/validation, and removal timestamps.
- Added owner/member, access lifecycle, event, post-media, and active-report indexes.
- Added event validation checks, one-owner partial uniqueness, deferred owner membership reference, and synchronous current-owner protection.
- Added `COMMUNITY_CONTENT_SNAPSHOT` report evidence.
- Added migrations `20260716220000_report_evidence_community`, `20260716221000_community_operations`, and `20260716222000_community_owner_trigger_fix`.

## API Changes

- Added Community create/update/archive/transfer/member-role/member-removal/invitation/access-decision/report endpoints.
- Added Post update/remove/moderation/comment/report endpoints.
- Added Comment update/remove/reaction/report endpoints.
- Added paginated Community Admin list/detail/update endpoints.
- Updated Community directory and Post creation endpoints to use explicit safe DTOs and the shared community domain.

## UI/UX Changes

- Added Community creation dialog, reviewed-state messaging, reference selection, privacy/access choices, and cover uploads.
- Added paginated/searchable discovery with responsive covers and pending request/invitation state.
- Added owner/moderator management for settings, members, invitations, requests, ownership, posts, events, and archival.
- Added post image grids, edit/remove/report/pin actions, event fields, staff announcements, and nested comment interaction.
- Added filtered/paginated Community CMS inventory and detailed operational review.

## Performance Improvements

- Bounded public directory, community feed, comment, management, and Admin CMS reads.
- Added database indexes for status/privacy/time, ownership, roles, access lifecycle, events, ordered media, and active reports.
- Kept announcement, event approval, access, and comment delivery asynchronous through the PostgreSQL outbox.
- Reused explicit selects and DTO mapping instead of serializing relational records.

## Security Improvements

- Enforced all owner/staff/Admin permissions on the server.
- Enforced one current owner membership and prevented direct owner demotion/deletion in PostgreSQL.
- Required trusted origin, authentication, Zod validation, and abuse limits on community mutations.
- Required owned `ACTIVE/CLEAN` purpose-compatible media and atomic attachment.
- Captured immutable report evidence, retained referenced media, and preserved Moderator/Admin/Super Admin redaction boundaries.
- Kept internal notes, sensitive evidence identifiers, and provider storage keys out of member responses.

## Files Created

- `app/(platform)/communities/[slug]/manage/page.tsx`
- `app/admin/communities/page.tsx`
- `app/admin/communities/[id]/page.tsx`
- `app/api/admin/communities/route.ts`
- `app/api/admin/communities/[id]/route.ts`
- `app/api/communities/[id]/route.ts`
- `app/api/communities/[id]/transfer/route.ts`
- `app/api/communities/[id]/invitations/route.ts`
- `app/api/communities/[id]/access/[requestId]/route.ts`
- `app/api/communities/[id]/members/[memberId]/route.ts`
- `app/api/communities/[id]/report/route.ts`
- `app/api/posts/[id]/route.ts`
- `app/api/posts/[id]/moderation/route.ts`
- `app/api/posts/[id]/comments/route.ts`
- `app/api/posts/[id]/report/route.ts`
- `app/api/comments/[id]/route.ts`
- `app/api/comments/[id]/reactions/route.ts`
- `app/api/comments/[id]/report/route.ts`
- `src/components/features/admin/CommunityAdminActions.tsx`
- `src/components/features/community/CommentThread.tsx`
- `src/components/features/community/CommunityCreateDialog.tsx`
- `src/components/features/community/CommunityManagePanel.tsx`
- `src/components/features/community/ContentReportButton.tsx`
- `src/components/features/community/PostActions.tsx`
- `src/lib/client-media.ts`
- `src/lib/communities.ts`
- `prisma/migrations/20260716220000_report_evidence_community/migration.sql`
- `prisma/migrations/20260716221000_community_operations/migration.sql`
- `prisma/migrations/20260716222000_community_owner_trigger_fix/migration.sql`
- `tests/integration/communities-postgres.test.ts`

## Files Modified

- `package.json`
- `package-lock.json`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `app/(platform)/home/page.tsx`
- `app/(platform)/communities/page.tsx`
- `app/(platform)/communities/[slug]/page.tsx`
- `app/admin/reports/[id]/page.tsx`
- `app/api/communities/route.ts`
- `app/api/communities/[id]/members/route.ts`
- `app/api/posts/route.ts`
- `src/components/features/admin/AdminNav.tsx`
- `src/components/features/community/CommunityCard.tsx`
- `src/components/features/community/CommunityJoinButton.tsx`
- `src/components/features/community/FeedPost.tsx`
- `src/components/features/community/PostComposer.tsx`
- `src/lib/authorization.ts`
- `src/lib/content-visibility.ts`
- `src/lib/moderation.ts`
- `src/lib/platform-queries.ts`
- `src/lib/validation.ts`
- `tests/integration/profiles-postgres.test.ts`
- `tests/unit/authorization.test.ts`
- `tests/unit/content-visibility.test.ts`
- `tests/unit/protected-target-routes.test.ts`
- `tests/unit/search-security.test.ts`
- `tests/unit/validation.test.ts`
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/COMPONENTS.md`
- `docs/DATABASE.md`
- `docs/DEPLOYMENT.md`
- `docs/ROADMAP.md`
- `docs/SECURITY.md`

## Files Removed

- None.

## Breaking Changes

- Version 0.13.0 requires all three community migrations before the new build is served.
- Existing clients that assumed every private community was invitation-inaccessible must now handle pending invitation access and request state.
- Community creation returns `PENDING_REVIEW`; it is not public until Admin activation.

## Migration Notes

- Back up PostgreSQL and run `npx prisma migrate deploy` before deployment.
- Confirm every legacy community has a valid `createdById`; the migration makes that user the operational owner and creates/normalizes the OWNER membership.
- Existing published events are backfilled with `eventValidatedAt`; future member-created events require explicit staff validation.
- The migration preserves communities, posts, comments, media metadata, reports, and audit history.
- Keep the notification worker and media cleanup tasks scheduled.

## Next Recommended Tasks

- Implement Module 12 Marketplace lifecycle and migrate listing media to Module 5.
- Preserve Module 11 owner, evidence, notification, and visibility contracts in every dependent module.
- Add browser E2E coverage for community creation, invitation acceptance, ownership transfer, event validation, and responsive Admin CMS.

⸻

# Version 0.14.0

Date:
2026-07-19

## Summary

Completed and closed out Module 12 Marketplace lifecycle. The listing state machine, Module 5 media migration, fraud scoring, seller dashboard, category CRUD, automated expiry, and Marketplace Admin CMS were already implemented against real PostgreSQL with a dedicated integration suite; this release fixes the stale fixtures/assertions that had not been updated for the module's own visibility rules, finishes migrating the demo seed off legacy image keys, and brings documentation and the package version in line with the shipped feature.

## Features Added

- None. Module 12's application features (lifecycle transitions, fraud holds, Module 5 media attachment, category CRUD, automated expiry, report evidence, Admin CMS) were already present in the codebase.

## Features Modified

- None.

## Bugs Fixed

- Corrected `tests/unit/protected-target-routes.test.ts` to expect the current `activeListingWhere()` shape (status, `expiresAt`, active category) instead of the pre-Module-12 status-only check, fixing five failing assertions.
- Corrected the Module 6 profile and Module 8 notification integration-test listing fixtures to set `expiresAt`, matching every real application code path that creates an `ACTIVE` listing; this fixed a profile activity/count mismatch and a false "Marketplace listing not found" failure in the Marketplace contact message producer.
- Migrated the demo seed's four Marketplace listings from legacy `objectKey`-only images to real Module 5 `MediaAsset` records with generated image bytes in local object storage, and gave them `expiresAt`, so seeded listings are visible under the current lifecycle rules and render real photos instead of a category-icon fallback.

## Database Changes

- No new tables, columns, indexes, or migrations. Module 12's schema (`ListingStatus.EXPIRED`, fraud fields, `ListingImage.mediaId`) and its backfill of `expiresAt` for pre-existing listings were already delivered by migrations `20260716230000_marketplace_enums` and `20260716231000_marketplace_operations`.

## API Changes

- None. `GET|POST /api/marketplace`, `PATCH /api/marketplace/:id`, `POST /api/marketplace/:id/status`, `POST|DELETE /api/marketplace/:id/favorites`, `POST /api/marketplace/:id/report`, `POST /api/internal/marketplace/expire`, and the `admin/marketplace` + `admin/marketplace/categories` routes were already implemented.

## UI/UX Changes

- None. `/marketplace`, `/marketplace/new`, `/marketplace/[slug]`, `/marketplace/[slug]/edit`, `/marketplace/selling`, and the Admin Marketplace CMS pages were already implemented.

## Performance Improvements

- None beyond what Module 12 already delivered.

## Security Improvements

- None beyond what Module 12 already delivered; fraud-score gating, evidence retention/redaction, and CMS permission separation were already enforced.

## Files Created

- None.

## Files Modified

- `tests/unit/protected-target-routes.test.ts`
- `tests/integration/profiles-postgres.test.ts`
- `tests/integration/notifications-postgres.test.ts`
- `prisma/seed.ts`
- `package.json`
- `docs/ROADMAP.md`
- `docs/API.md`
- `docs/DATABASE.md`
- `docs/COMPONENTS.md`
- `docs/SECURITY.md`
- `docs/CHANGELOG.md`

## Files Removed

- None.

## Breaking Changes

None. This release only corrects test fixtures, migrates seed data, and updates documentation.

## Migration Notes

- No new database migration is required; existing deployments already carry Module 12's schema and `expiresAt` backfill.
- Re-run `npm run db:seed` in local/demo environments only if you want the seed's marketplace listings to carry real Module 5 images.

## Next Recommended Tasks

- Add cursor pagination and PostgreSQL full-text indexes; measure before adopting a dedicated search service.
- Finish email verification, password reset, session/device management, and one first-party OAuth provider.
- Replace in-memory rate limits with shared Redis-compatible limits.

⸻

# Version 0.15.0

Date:
2026-07-19

## Summary

Implemented Module 13: PostgreSQL full-text search with cursor pagination, replacing substring (`ILIKE`) matching across all six searchable content types and adding a paginated single-category "view all" flow to the existing Search preview.

## Features Added

- Added a generated, field-weighted `tsvector` column with a GIN index to `Community`, `MarketplaceListing`, `Guide`, `Question`, `Post`, and `User`, ranking title/name matches above description/body-only matches.
- Added `GET /api/search?type=&cursor=&limit=` for cursor-paginated single-category results alongside the existing mixed-category preview.
- Added a "View all" link per category on `/search` once a category reaches the 6-item preview cap, and a client `CategoryResults` "Load more" panel backed by the new endpoint.

## Features Modified

- Rewrote `searchKondo`'s per-category matching from Prisma `contains`/`ILIKE` to `websearch_to_tsquery`/`ts_rank` full-text queries. Every full-text candidate is still re-checked through the existing typed content-visibility policies before it reaches a response, so full-text matching cannot surface anything normal visibility rules would hide.
- Moved `searchKondo` out of `src/lib/platform-queries.ts` into a new `src/lib/search.ts` module boundary, matching the one-file-per-domain convention used by Marketplace, Messaging, and Communities.

## Bugs Fixed

- None; this is a new module.

## Database Changes

- Added migration `20260717000000_search_full_text`: one generated `tsvector` column and one GIN index per searchable model. No existing column was altered or removed.

## API Changes

- Added the `type`/`cursor`/`limit` query parameters to `GET /api/search`; omitting `type` preserves the exact existing preview response contract.

## UI/UX Changes

- Added "View all" links from the Search preview to a paginated single-category view, and a "Load more" control within it.
- No existing route, layout, or navigation destination changed.

## Performance Improvements

- Replaced full-table `ILIKE` substring scans with GIN-indexed full-text lookups across all six searchable models.
- Cursor pagination avoids the cost of large `OFFSET` scans on subsequent pages.

## Security Improvements

- Full-text search only ever returns candidate IDs and a rank; every candidate is re-verified against the same content-visibility policy used by every other read path (community membership, published state, active listing state) before it is serialized, on every page, not only the first.
- Added a unit-test regression (`search-security.test.ts`) confirming raw Prisma objects, private user fields, and internal identifiers still never reach a search response.

## Files Created

- `prisma/migrations/20260717000000_search_full_text/migration.sql`
- `src/lib/search.ts`
- `src/components/features/search/ResultCard.tsx`
- `src/components/features/search/CategoryResults.tsx`
- `tests/integration/search-postgres.test.ts`

## Files Modified

- `src/lib/platform-queries.ts`
- `app/api/search/route.ts`
- `app/(platform)/search/page.tsx`
- `prisma/schema.prisma`
- `tests/unit/search-security.test.ts`
- `tests/unit/search-route-auth.test.ts`
- `package.json`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/DATABASE.md`
- `docs/COMPONENTS.md`
- `docs/SECURITY.md`
- `docs/ROADMAP.md`
- `docs/CHANGELOG.md`

## Files Removed

- None.

## Breaking Changes

None. `GET /api/search?q=` without `type` returns the exact same response shape as before.

## Migration Notes

- Run `npx prisma migrate deploy` before deploying; the migration is additive (new column + index only) and safe to apply without downtime.
- No seed or application-data backfill is required; generated columns compute automatically for existing rows.

## Next Recommended Tasks

- Finish email verification, password reset, session/device management, and one first-party OAuth provider.
- Replace in-memory rate limits with shared Redis-compatible limits.
- Connect email digest delivery to a reviewed email provider and consent policy when infrastructure is approved.

⸻

# Version 0.16.0

Date:
2026-07-19

## Summary

Implemented Module 14 email verification and password reset. Session/device management was already complete from Module 7 and needed no further work. Selecting and wiring a first-party OAuth provider is deliberately deferred: it requires a product decision on which provider to use and real client credentials, neither of which exist yet.

## Features Added

- Added `EmailVerificationToken` and `PasswordResetToken`: single-use, SHA-256-hashed, expiring tokens (24h / 1h), mirroring `Session`'s hash-only storage pattern.
- Added `POST /api/auth/verify-email/request`, `POST /api/auth/verify-email/confirm`, `POST /api/auth/password-reset/request`, and `POST /api/auth/password-reset/confirm`.
- Added `/forgot-password` (request a reset), `/reset-password` (confirm with a new password), and `/verify-email` (confirm a verification link) pages.
- Added a resend-verification banner to Settings → Account, shown only when `emailVerifiedAt` is unset.
- Added `src/lib/email.ts`, a provider-neutral transactional email boundary. Without a configured `EMAIL_PROVIDER` it no-ops outside production (the raw token is returned directly for local testing) and throws rather than pretending to deliver in production.

## Features Modified

- Added `emailVerifiedAt` to the shared authenticated-user select (`src/lib/server-auth.ts`) so any page can read verification state without an extra query.
- Exported `passwordSchema` from `src/lib/validation.ts` for reuse by the new password-reset confirmation schema.
- Added a "Forgot password?" link to the login form.

## Bugs Fixed

- None; this is a new module.

## Database Changes

- Added migration `20260717010000_auth_verification_reset`: two new tables (`EmailVerificationToken`, `PasswordResetToken`), each with a unique hashed-token index and a user/used-at index. No existing table was altered.

## API Changes

- Added the four `/api/auth/verify-email/*` and `/api/auth/password-reset/*` endpoints described above.

## UI/UX Changes

- Added the three new auth-adjacent pages and the Settings → Account verification banner. No existing route, layout, or navigation destination changed.

## Performance Improvements

- None material; token lookups use the new unique hashed-token indexes.

## Security Improvements

- Tokens are single-use: confirming one marks it used, and requesting a new one invalidates any unused prior token for that user.
- Password-reset confirmation revokes every session for that user in the same transaction as the password change.
- Password-reset requests always take a comparable path and return the same generic response whether or not the email matches an active account, and are rate limited per email, preventing account enumeration through this endpoint.
- Verification-request and reset-request endpoints are rate limited (3/hour, 5/hour respectively) independent of the generic auth rate limits.
- Raw tokens are never persisted or logged; only their SHA-256 hash is stored, and the raw value is returned in an API response only outside production, exclusively to keep the flow testable without a live email provider.

## Files Created

- `prisma/migrations/20260717010000_auth_verification_reset/migration.sql`
- `src/lib/auth-tokens.ts`
- `src/lib/email.ts`
- `app/api/auth/verify-email/request/route.ts`
- `app/api/auth/verify-email/confirm/route.ts`
- `app/api/auth/password-reset/request/route.ts`
- `app/api/auth/password-reset/confirm/route.ts`
- `app/forgot-password/page.tsx`
- `app/reset-password/page.tsx`
- `app/verify-email/page.tsx`
- `src/components/features/settings/EmailVerificationBanner.tsx`
- `tests/integration/auth-tokens-postgres.test.ts`

## Files Modified

- `prisma/schema.prisma`
- `src/lib/server-auth.ts`
- `src/lib/validation.ts`
- `app/login/page.tsx`
- `app/(platform)/settings/account/page.tsx`
- `.env.example`
- `package.json`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/DATABASE.md`
- `docs/SECURITY.md`
- `docs/ROADMAP.md`
- `docs/CHANGELOG.md`

## Files Removed

- None.

## Breaking Changes

None. No existing endpoint, page, or response contract changed.

## Migration Notes

- Run `npx prisma migrate deploy` before deploying; the migration only adds two new tables.
- Set `EMAIL_PROVIDER` before relying on this in production; without it, `sendTransactionalEmail` throws in production rather than silently no-op-ing, so verification/reset requests will fail loudly until a provider is connected.

## Next Recommended Tasks

- Select and wire one first-party OAuth provider once a provider decision and client credentials are available.
- Replace in-memory rate limits with shared Redis-compatible limits.
- Connect a reviewed email provider for verification, password reset, and digest delivery.

⸻

# Version 0.17.0

Date:
2026-07-19

## Summary

Implemented Module 17: Admin actions for user status/session control, and a guide publishing CMS. Both permission-gated to Admin/Super Admin, both fully audited, and both built on existing tables — no schema migration was needed for the guide CMS, and only a permission-enum addition (no new tables) for user management.

## Features Added

- Added `USER_MANAGE`: Admin/Super Admin can set a member's status (`ACTIVE`/`SUSPENDED`/`DEACTIVATED`) with a required reason, and independently force-revoke all of a user's sessions. Suspending or deactivating revokes every session for that user in the same transaction. Blocked against the actor's own account, and against a Super Admin target unless the actor is also Super Admin.
- Added `GUIDE_CMS_VIEW`/`GUIDE_CMS_MANAGE`: Admin/Super Admin can create, edit, and publish/unpublish guides, and add/edit/delete their ordered steps. A guide cannot publish with zero steps. Deleting a guide is blocked while published or while any step has recorded member progress.
- Added `/admin/guides` (searchable, paginated, published/draft filter, create form) and `/admin/guides/[id]` (edit details, publish/unpublish, delete draft, manage steps).
- Added status/session controls to `/admin/users/[id]`.

## Features Modified

- None.

## Bugs Fixed

- None; this is a new module.

## Database Changes

- None. `USER_MANAGE`/`GUIDE_CMS_VIEW`/`GUIDE_CMS_MANAGE` are additions to the existing `AdminPermission` TypeScript union, not a schema change. Guide CMS operates on the existing `Guide`/`GuideStep` tables from the original schema.

## API Changes

- Added `PATCH /api/admin/users/:id/status` and `DELETE /api/admin/users/:id/sessions`.
- Added `GET|POST /api/admin/guides`, `GET|PATCH|DELETE /api/admin/guides/:id`, `POST /api/admin/guides/:id/publish`, `POST /api/admin/guides/:id/steps`, and `PATCH|DELETE /api/admin/guides/:id/steps/:stepId`.

## UI/UX Changes

- Added a "Guides" entry to `AdminNav` and the two new guide CMS pages.
- Added an account-control card to the existing `/admin/users/[id]` page, visible only to actors with `USER_MANAGE` and hidden on the actor's own profile.

## Performance Improvements

- None material.

## Security Improvements

- User status changes and session revocation require `USER_MANAGE`, are blocked against self-targeting, and are blocked against a Super Admin target unless the actor is also Super Admin — preventing a compromised or malicious Admin from disabling account-management oversight of itself or of Super Admins.
- Every status change, session revocation, guide mutation, and step mutation writes a transactional AuditLog entry.
- Guide CMS access requires `GUIDE_CMS_VIEW`/`GUIDE_CMS_MANAGE`; Moderator and Member have no guide-administration access.

## Files Created

- `src/lib/guides.ts`
- `app/api/admin/users/[id]/status/route.ts`
- `app/api/admin/users/[id]/sessions/route.ts`
- `app/api/admin/guides/route.ts`
- `app/api/admin/guides/[id]/route.ts`
- `app/api/admin/guides/[id]/publish/route.ts`
- `app/api/admin/guides/[id]/steps/route.ts`
- `app/api/admin/guides/[id]/steps/[stepId]/route.ts`
- `app/admin/guides/page.tsx`
- `app/admin/guides/[id]/page.tsx`
- `src/components/features/admin/UserStatusActions.tsx`
- `src/components/features/admin/GuideCreateForm.tsx`
- `src/components/features/admin/GuideEditForm.tsx`
- `src/components/features/admin/GuidePublishActions.tsx`
- `src/components/features/admin/GuideStepManager.tsx`
- `tests/integration/admin-actions-postgres.test.ts`

## Files Modified

- `src/lib/authorization.ts`
- `src/lib/profiles.ts`
- `src/lib/validation.ts`
- `src/components/features/admin/AdminNav.tsx`
- `app/admin/users/[id]/page.tsx`
- `tests/unit/authorization.test.ts`
- `package.json`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/DATABASE.md`
- `docs/COMPONENTS.md`
- `docs/SECURITY.md`
- `docs/ROADMAP.md`
- `docs/CHANGELOG.md`

## Files Removed

- None.

## Breaking Changes

None. No existing endpoint, page, permission, or response contract changed; both new permissions are additive.

## Migration Notes

- No database migration is required.

## Next Recommended Tasks

- Select and wire one first-party OAuth provider once a provider decision and client credentials are available.
- Replace in-memory rate limits with shared Redis-compatible limits.
- Connect a reviewed email provider for verification, password reset, and digest delivery.

⸻

# Version 0.18.0

Date:
2026-07-20

## Summary

Recovered an interrupted work-in-progress and completed the remaining infrastructure and content-operations modules. A prior session had left `src/lib/validation.ts` truncated to a placeholder, which broke the build across ~28 route handlers; it has been restored and the previously-drafted Modules 15 (Redis rate limiting), 16 (Resend email), 18 (Playwright E2E), and 19 (analytics) have been verified, wired end-to-end, and confirmed against the full quality gate. Module 20 (City Hub editorial workflow) is a new, database-backed Draft → Review → Published pipeline for the Explore-your-city hubs, with admin-only publishing and a static-registry fallback.

## Features Added

- **Module 20 — City Hub editorial workflow.** New `CityHub` model with a `CityHubStatus` (`DRAFT`/`REVIEW`/`PUBLISHED`) editorial state machine. City content is edited as a structured JSON payload validated against the `ExploreCity` shape, so a hub can only be saved or published when its content conforms. Publishing copies the working `draft` into a `published` snapshot; the public `/explore/[city]` pages serve that snapshot when present and fall back to the static typed registry otherwise, so revising a published hub (reverting it to draft) never takes the live page down. New `CITY_CMS_VIEW`/`CITY_CMS_MANAGE` permissions (Admin/Super Admin only) — publishing is therefore administrator-only. Admin CMS at `/admin/city-hubs` (list/filter/create, seed-from-registry) and `/admin/city-hubs/[id]` (edit draft, run transitions, preview live snapshot). Optimistic-concurrency `version` guard and transactional AuditLog entries on every mutation.
- **Module 19 — Analytics instrumentation completed.** Added the missing `EXPLORE_CITY_VIEWED` event on the Explore-your-city page. All ten target events are now instrumented on the shared `AnalyticsEvent` model via `trackEvent`: registration, login, community creation, post creation, listing creation, marketplace contact, message sent, search, Student Hub, and Explore-city visits.

## Features Modified

- Restored `src/lib/validation.ts` (regenerated from the committed baseline plus the eight schemas the Module 14/17 routes require: `requestPasswordResetSchema`, `confirmPasswordResetSchema`, `confirmEmailVerificationSchema`, `adminUserStatusSchema`, `createGuideSchema`, `updateGuideSchema`, `guidePublishSchema`, `guideStepSchema`) and added the Module 20 payload/operation schemas.
- Verified Modules 15, 16, and 18 (dependencies and scaffolding were present from the interrupted session): `rateLimit` is Upstash-backed with an in-memory fallback and is awaited by all ~30 callers; `sendTransactionalEmail` routes through Resend and is invoked by the verification, password-reset, and digest flows; Playwright is configured against `./e2e` with guest/authenticated/setup projects and does not collide with the Vitest suite.

## Bugs Fixed

- Fixed the build-breaking placeholder in `src/lib/validation.ts` that made the module fail to compile and cascaded `TS2306` errors into every route importing it.

## Database Changes

- Added enum `CityHubStatus` and model `CityHub` (`slug` unique, `status`, `draft` JSONB, `published` JSONB nullable, `version`, `publishedAt`, author/editor relations, `@@index([status, updatedAt])`). Migration `20260720000000_city_hub_editorial`. No existing table changed.

## API Changes

- Added `GET|POST /api/admin/city-hubs`, `GET|PATCH|DELETE /api/admin/city-hubs/:id`, and `POST /api/admin/city-hubs/:id/status`. All require `CITY_CMS_VIEW`/`CITY_CMS_MANAGE`, enforce trusted origin on writes, and use optimistic-concurrency versions.

## UI/UX Changes

- Added a "City hubs" entry to `AdminNav` (visible with `CITY_CMS_VIEW`) and the two new admin pages, plus a per-visit analytics call on the public Explore page.

## Security Improvements

- City hub publishing is gated to Admin/Super Admin, every mutation is transactional with a mandatory AuditLog record, and content is schema-validated before it can be published so malformed data can never reach the public page.

## Files Created

- `src/lib/city-hub.ts`
- `app/api/admin/city-hubs/route.ts`, `app/api/admin/city-hubs/[id]/route.ts`, `app/api/admin/city-hubs/[id]/status/route.ts`
- `app/admin/city-hubs/page.tsx`, `app/admin/city-hubs/[id]/page.tsx`
- `src/components/features/admin/CityHubCreateForm.tsx`, `CityHubEditor.tsx`, `CityHubStatusActions.tsx`
- `prisma/migrations/20260720000000_city_hub_editorial/migration.sql`
- `tests/integration/city-hub-postgres.test.ts`

## Files Modified

- `src/lib/validation.ts`, `src/lib/authorization.ts`
- `app/(platform)/explore/[city]/page.tsx`, `app/(platform)/explore/[city]/[section]/page.tsx`
- `src/components/features/admin/AdminNav.tsx`
- `prisma/schema.prisma`
- `docs/ROADMAP.md`, `docs/DATABASE.md`, `docs/API.md`, `docs/CHANGELOG.md`

## Breaking Changes

None. All additions are additive; existing routes, permissions, and response contracts are unchanged.

## Migration Notes

- Apply migration `20260720000000_city_hub_editorial` (`npx prisma migrate deploy`).
- Redis and email remain optional: with `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` unset the limiter uses the in-memory fallback, and with `RESEND_API_KEY`/`EMAIL_FROM` unset transactional email no-ops outside production. All four are documented in `.env.example`.
- Environment note: if `node_modules` is transferred as an archive (e.g. via a chat client) macOS may quarantine the native Prisma/Next binaries; clear it with `xattr -dr com.apple.quarantine node_modules` or reinstall.

## Next Recommended Tasks

- Select and wire one first-party OAuth provider once a provider decision and client credentials are available.
- Provision the real Upstash Redis and Resend credentials in the deployment environment to activate shared rate limits and live email.
- Move the remaining city-hub content off the static registry as more cities adopt the editorial workflow, and add partner verification/expiry for jobs and dated events.

⸻

# Version 0.19.0

Date:
2026-07-20

## Summary

Production-hardening and deployment enablement that requires no external credentials. Makes background work runnable on Vercel Cron, prepares Prisma for managed serverless Postgres, adds a health probe, expands end-to-end coverage, and completes the environment documentation and go-live runbook.

## Features Added

- Cron-compatible internal worker routes: `/api/internal/notifications/process`, `/notifications/digest`, and `/marketplace/expire` now accept `GET` (for Vercel Cron) and `POST`, authorized by a shared `CRON_SECRET` or their per-worker secret via a new `src/lib/worker-auth.ts` helper.
- New `/api/internal/media/cleanup` route exposing the previously CLI-only media cleanup so it can run on a schedule.
- `vercel.json` with cron schedules for all four background jobs.
- Unauthenticated `GET /api/health` readiness probe (database round-trip; 200/503) that leaks no build or schema detail.
- Expanded Playwright suite: a super-admin auth setup and `admin` project, plus member-journey specs (Explore city hub, notifications, settings, profile edit, mobile bottom navigation) and admin-operations specs (overview, City Hub CMS, Guides CMS). 12 → 20 tests across 7 files.

## Features Modified

- Prisma datasource now declares `directUrl` (env `DIRECT_URL`) so `prisma migrate deploy` uses a direct connection while the app uses the pooled `DATABASE_URL`; `scripts/prepare-test-db.mjs` threads `DIRECT_URL` for the local/test database.

## Database Changes

- None. `DIRECT_URL` is a connection-configuration addition, not a schema change.

## API Changes

- Added `GET /api/health`. Added `GET` handlers to the three existing internal worker routes and a new `GET|POST /api/internal/media/cleanup`.

## Security Improvements

- Internal worker routes use constant-time secret comparison and are closed by default when no secret is configured. Health and worker routes are `no-store` and expose no sensitive detail.

## Files Created

- `src/lib/worker-auth.ts`, `app/api/internal/media/cleanup/route.ts`, `app/api/health/route.ts`
- `vercel.json`
- `e2e/admin.setup.ts`, `e2e/member-journeys.authenticated.spec.ts`, `e2e/admin-operations.admin.spec.ts`

## Files Modified

- `prisma/schema.prisma`, `scripts/prepare-test-db.mjs`
- `app/api/internal/notifications/process/route.ts`, `app/api/internal/notifications/digest/route.ts`, `app/api/internal/marketplace/expire/route.ts`
- `playwright.config.ts`, `.env.example`, `docs/DEPLOYMENT.md`, `docs/CHANGELOG.md`

## Breaking Changes

None. All additions are additive and backward-compatible; existing `POST` worker triggers continue to work with their worker secrets.

## Migration Notes

- Set `DIRECT_URL` in every environment (equal to `DATABASE_URL` for a non-pooled/local database). Set `CRON_SECRET` in Vercel to enable the scheduled jobs. Sub-daily cron frequencies require a Vercel Pro plan; otherwise run the equivalent CLI scripts from an external scheduler.

## Next Recommended Tasks

- Provide the production infrastructure credentials (PostgreSQL, object storage, optional Upstash/Resend) and configure Vercel.
- Decide on and wire a first-party OAuth provider if desired.

⸻

# Version 1.0.0-rc.2

Date:
2026-07-21

## Summary

Completes the production administrator back office with real operational data,
structured editorial workflows, role safety, targeted announcements, official
community ownership, and production documentation.

## Features Added

- Added `/admin/analytics`, `/admin/content`, and `/admin/settings` using real
  database aggregates and safe, non-secret configuration status.
- Added Super-Admin-only member role changes with self-change protection,
  immediate session revocation, and mandatory audit logging.
- Replaced the City Hub raw JSON interface with a structured module and entry
  editor, a protected preview, confirmed publication, and explicit unpublish.
- Added targeted announcement audiences for all active members, a city,
  university, or community membership.
- Added explicit administrator-created official communities while retaining
  separate moderation workflows for user-created communities.
- Added secure R2-backed Student Hub guide cover upload, preview, replacement,
  removal, and public rendering through `MediaAsset`.

## Features Modified

- Expanded the Admin dashboard with real user, content, moderation, marketplace,
  event, analytics, and recent-audit metrics.
- Added public official-community labels and prioritization without conflating
  official ownership with verification.
- Expanded user detail with public activity context and active listings.

## Database Changes

- Migration `20260721100000_notification_announcement_audience` adds nullable
  JSONB audience metadata to `NotificationAnnouncement`.
- Migration `20260721103000_official_communities` adds indexed
  `Community.isOfficial` with a safe `false` default.
- Migration `20260721110000_guide_cover_media` adds the nullable, unique
  `Guide.coverMediaId` relation to validated `MediaAsset` records.

## Security Improvements

- Role management is restricted to Super Admin, blocks self-demotion, revokes
  target sessions, and creates an AuditLog entry.
- User-created community metadata cannot be silently rewritten by Admin;
  operators retain status, verification, and moderation controls.
- City Hub publication remains permission-gated and version-guarded; unpublish
  removes the managed public snapshot without exposing a static fallback.
- The settings index never reads or renders secret values.

## Tests

- Added PostgreSQL integration coverage for role changes, targeted
  announcements, City Hub unpublish, and official-community ownership rules.
- Expanded authorization and Playwright Admin-route coverage.

## Migration Notes

- Back up production, run `npx prisma migrate deploy` through `DIRECT_URL`, and
  deploy the application only after all three migrations succeed.
- Existing communities intentionally remain user-created (`isOfficial=false`).
  Do not bulk-mark them official without an ownership review.

⸻

# Version 1.0.0-rc.3

Date:
2026-07-21

## Summary

Refactors City Hub administration from one combined document form into
independent management areas while preserving the existing JSON data contract,
permissions, editorial state machine, and public Explore snapshots.

## Features Modified

- `/admin/city-hubs/:id` is now a navigation page for Hub details and every
  existing City Hub section.
- Hub details, section metadata, and each section entry now save through
  separate forms and targeted API mutations.
- Each entry can be created, edited, reloaded, and deleted without submitting
  another section or replacing unrelated draft content.
- Existing content types and terminology remain unchanged: `company`,
  `product`, `university`, `opportunity`, `event`, `service`, and `story`.
- The existing `DRAFT → REVIEW → PUBLISHED` workflow still validates and
  promotes the complete current draft to the immutable public snapshot.

## API Changes

- Added `PATCH /api/admin/city-hubs/:id/details`.
- Added `PATCH /api/admin/city-hubs/:id/sections/:sectionSlug`.
- Added `POST /api/admin/city-hubs/:id/sections/:sectionSlug/entries`.
- Added `PATCH|DELETE /api/admin/city-hubs/:id/sections/:sectionSlug/entries/:entryId`.
- Removed the combined City Hub `PATCH` mutation used by the former large form.
- Every targeted write retains trusted-origin checks, `CITY_CMS_MANAGE`, atomic
  optimistic concurrency, and transactional audit logging.

## Database Changes

None. Existing `draft` and `published` JSONB values remain compatible and no
data migration is required.

## Tests

- Added PostgreSQL coverage proving that an internship can be created and
  reloaded independently, section and entry edits leave Companies unchanged,
  publication still reaches Explore, deletion remains isolated, and the last
  published snapshot stays live during revision.
- Updated the test command to load an optional local `.env` before database
  preparation and Vitest, preventing the runner from silently using a different
  local PostgreSQL port.
