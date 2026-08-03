# Kondo Components

## Design language

Kondo uses a warm, calm visual system: deep forest/ink anchors, emerald actions, lime highlights, soft sand backgrounds, generous rounded surfaces, and restrained elevation. The interface supports light and dark modes and honors reduced-motion preferences.

## Application shell

- `AppShell`: responsive desktop sidebar, sticky global search/header, theme toggle, real unread-notification badge, Explore utility menu, profile entry point, mobile drawer, and mobile bottom navigation. Its five product destinations are Home, Communities, Marketplace, Student Hub, and Messages; legacy guide/help routes activate Student Hub.
- `ExploreMenu`: accessible top-right dropdown for Explore Jiaxing, City Events, Settings, and Language. Its high-contrast trigger stays visible as a compact ⋮ button on phones and a labeled Explore pill from tablet widths upward; it closes on outside interaction, Escape, and route selection without introducing a second primary navigation system.
- App-route transitions use a restrained Framer Motion fade/4px lift and disable themselves when reduced motion is requested.
- `KondoLogo`: CSS-native brand mark and wordmark. It has no dependency on the retired transfer-era image asset.
- `ThemeProvider`: system-aware theme state through `next-themes`.
- The authenticated shell synchronizes the saved account theme and persists changes made by its compact Light/Dark toggle; System remains selectable in Settings.
- The shell shows real Messages and Notifications badges, provides Command/Ctrl+K Search, exposes logout on desktop/mobile, closes the mobile dialog with Escape, and derives Admin visibility from the permission matrix.
- The platform route group supplies responsive loading, generic retryable error, and non-disclosing not-found states.

## UI primitives

- `Button`: shadcn-style variant composition using Radix Slot, class-variance-authority, and Tailwind merging. Supports primary, secondary, ghost, soft, danger, multiple sizes, and `asChild` composition.
- `Card`: shared elevated surface with light/dark tokens.
- `Avatar`: deterministic accessible initials and stable profile color.
- `PageHeader`: page-level title, eyebrow, description, and action layout.
- `MediaImage`: stable media-ID image renderer using Next Image. Private media bypasses the server optimizer so the browser session cookie reaches the protected delivery endpoint.
- Feature forms use shared visual tokens and native semantic controls; a new shared primitive should be introduced only when two implemented flows require the same behavior.

## Feature components

### Community

- `CommunityCard`: cover media, membership/request state, join policy, verification, recent activity, member/post counts, and responsive card treatment.
- `CommunityCreateDialog`: reviewed community creation across Topic/Country/City/University types with privacy, access policy, reference selection, and validated cover upload.
- `CommunityJoinButton`: open join, approval request, invitation acceptance, leave, pending feedback, cookie credentials, and server-enforced ownership protection.
- `CommunityManagePanel`: owner/staff settings, cover replacement, invitations, access decisions, roles, ownership transfer, member removal, event validation, content moderation, and archival.
- `PostComposer`: discussion/question/event/announcement dialog with staff-aware choices, event fields, up to four Module 5 images, validation feedback, and pending-event messaging.
- `FeedPost`: author/community identity, pin state, validated image grid, content, counts, reactions, comments, direct messaging, sharing, bookmarks, edit/remove/report, and staff pin controls.
- `CommentThread`: create/reply/edit/remove, helpful reactions, direct messaging, report entry, nested presentation, and transactional server refresh.
- `ContentReportButton` and `PostActions`: reusable community safety and post ownership/moderation controls.
- `FeedPost` also exposes direct messaging for another post author without adding friend or follow state.

### Student Stories

- `StoryPreviewRail`: immersive horizontal discovery rail with vertical poster cards, creator avatar, country, university, category, duration, responsive touch snapping, and contextual Story entry tracking.
- `StoryReader`: full-viewport vertical reader with real playback progress, adjacent Story preloading, tap/keyboard navigation, play/pause, mute, captions, reactions, comments, reporting, creator identity, and reduced-motion/data-saver support.
- Demo-only story media can be installed locally with `npm run stories:demo` after explicitly setting `KONDO_ALLOW_DEMO_STORIES=true`; the script refuses production and non-local storage.

### Community Admin

- `CommunityAdminActions`: Admin/Super Admin activation, archival/removal lifecycle, and platform verification control.
- `/admin/communities`: responsive filtered/paginated CMS inventory.
- `/admin/communities/[id]`: safe ownership, membership, request, content, and moderation detail with handoff to operational management.

### Shared engagement

- `BookmarkButton`: reusable persisted bookmark state for currently visible published posts, active listings, published guides, and published questions, with optimistic rollback and optional compact rendering.
- `MarkAllReadButton`: bulk notification read-state mutation followed by a server-data refresh.
- `NotificationItem`: click-to-read row with actor avatar, unread styling, validated internal navigation, optimistic read state, and soft-hide action.
- The notifications page uses server pagination, real total/unread counts, safe DTOs, an empty state, and Previous/Next controls.

### Search

- `ResultCard`: shared presentational card reused by both the mixed-category preview and the single-category paginated view.
- `CategoryResults`: client "load more" panel for `/search?type=`; cursor-paginates one category through `/api/search` and renders category-specific cards (or the student `Avatar` card for `users`).
- `/search`: full-text preview across communities, listings, guides, questions, users, and posts, with a "View all" link per category once it reaches the 6-item preview cap; `?type=` switches the same route into the paginated single-category view.

### Profiles

- `ProfileView`: stable responsive rendering for public/member/owner profile DTOs, including permitted study context, visible communities, activity, marketplace entries, and coherent counters.
- `ProfileEditor`: owner-only profile form for identity, biography, study details, field-group audiences, and Module 5 avatar upload/replacement/removal.
- `ProfileSafetyActions`: member profile block/unblock and profile-report controls without introducing friend/follow mechanics.
- `AccountRequestPanel`: owner workflow for creating, reusing, listing, and cancelling data-export or account-deletion requests.
- Profile pages provide an owner view, an edit route, and username-addressed member views. Saved content is resolved through existing visibility rules rather than a parallel content system.

### Settings

- `AppearanceSettings`: accessible Light, Dark, and System selector with immediate visual application, server persistence, rollback, and feedback.
- `PrivacySettings`: dedicated field-group audience editor that reuses the Module 6 profile API and visibility model.
- `NotificationSettings`: persisted category and email-digest preferences prepared for the shared Module 8 notification service.
- `LanguageSettings`: persisted English, French, Chinese, or Arabic intent with an explicit incomplete-translation notice.
- `SessionsPanel`: safe active-device list, current-device marker, refresh, targeted revocation, other-device revocation, and sign-out-everywhere.
- `LogoutButton`: explicit current-device logout through the existing authenticated revocation endpoint.
- Settings provides dedicated responsive routes for Appearance, Privacy, Notifications, Language, Sessions & devices, and Account while retaining the existing `/language` utility route.

### Marketplace

- `ListingCard`: real Module 5 photo when available (category-icon fallback otherwise), price, city, seller, negotiation/favorite state, and listing detail link.
- `ListingFavoriteButton`: persisted optimistic favorite state on active listing detail; the API revalidates active status before writing.
- `ListingForm`: shared create/edit form that uploads up to 8 images through the Module 5 client pipeline, and supports draft/publish intents on create and save-in-place on edit.
- `ListingReportButton`: reuses the shared content-report flow to create/reuse an active listing report.
- `SellerListingActions`: seller-only lifecycle controls (publish/reserve/mark sold/archive/relist) on the seller dashboard, calling the status-transition endpoint.
- The seller dashboard (`/marketplace/selling`) paginates a seller's own listings with status, price, favorite count, and edit/lifecycle actions.

### Marketplace Admin

- `MarketplaceAdminActions`: Admin/Super Admin status override, fraud-review acknowledgement, and mandatory moderation note, gated on `MARKETPLACE_CMS_MANAGE`.
- `MarketplaceCategoryManager`: create/update/delete category workspace with dependency-safe deletion feedback.
- `/admin/marketplace`: responsive, searchable, paginated, flagged-first listing inventory for Admin/Super Admin.
- `/admin/marketplace/[id]`: full listing detail with fraud signals, legacy-image status, and moderation history.

### Guides

- `GuideCard`: category, reading time, completion count, and progress bar.
- `GuideChecklist`: expandable steps with optimistic completion and rollback on API failure; progress writes require a published parent guide.
- The guide library can filter to saved guides, and guide detail uses the shared persisted bookmark control.

### Guides Admin

- `GuideCreateForm`: creates a draft guide with a server-generated unique slug.
- `GuideEditForm`: edits title, summary, category, estimated minutes, and featured flag.
- `GuidePublishActions`: publish (disabled with zero steps)/unpublish toggle and delete-draft control, gated on `GUIDE_CMS_MANAGE`.
- `GuideStepManager`: add/edit/delete ordered steps inline; a step with recorded member progress cannot be deleted.
- `/admin/guides`: responsive, searchable, paginated inventory with a published/draft filter, plus the create form.
- `/admin/guides/[id]`: full guide workspace combining the above controls.

### Student Hub

- `StudentHubPage`: composes the existing guide and help-center capabilities into one resource dashboard with arrival, resource, Q&A, checklist, tip, article, and event entry points.
- Guide and help pages remain the source surfaces, so the merge changes navigation organization without duplicating or removing their behaviors.

### Messages

- `MessageUserButton`: reusable direct-conversation entry from profiles, posts, marketplace listings, comments, questions, and Student Hub answers.
- `MessageComposer`: text/emoji composer with keyboard sending, image/PDF selection, accessible image descriptions, two-phase Module 5 upload/validation, loading/error state, 2,000-character feedback, and first-message routing.
- `MarkConversationRead`: advances read state only to the newest message ID actually rendered on the newest history page.
- `ConversationActions`: participant-local archive/restore and delete-for-me controls plus block/unblock and report actions backed by protected APIs.
- Messages pages provide database-backed search, inbox/archive tabs, pagination, previews, timestamps, aggregate unread badges, paginated responsive bubbles, protected image rendering, PDF download, and unavailable-media state.

### Admin operations

- `AdminNav`: permission-filtered operations navigation. Moderators see Reports; Admin and Super Admin also see the platform overview and global AuditLog.
- `ReportCaseActions`: client interaction panel for claiming, assignment/reassignment, unassignment, internal notes, resolution, dismissal, and controlled reopening. Every request includes credentials and the current optimistic report version where required.
- `/admin/reports`: responsive, paginated queue with free-text, status, reason, target, and assignment filters. Case cards expose only safe list DTO fields.
- `/admin/reports/[id]`: responsive case workspace with lifecycle data, reporter/subject/assignee context, member details, permission-scoped evidence, internal notes, case audit timeline, and authorized operations.
- `/admin/audit`: filtered, paginated global AuditLog browser for Admin and Super Admin. Secret-bearing values are redacted for every role; request security metadata is rendered only for Super Admin.
- `ReferenceDataManager`: responsive create/edit/delete workspace for countries, cities, and universities with active/verified state, relational parent selectors, protected deletion feedback, and automatic refresh.
- `/admin/reference-data`: searchable, paginated reference-data CMS for Admin and Super Admin. It preserves the five product navigation destinations.
- `MediaAdminActions`: reasoned Admin removal control that preserves metadata and audit history and refreshes the inspection state.
- `/admin/media`: responsive filtered/paginated media inventory with safe previews and no storage-key exposure.
- `/admin/media/[id]`: validation, ownership, attachment, removal, delivery, and AuditLog inspection surface.
- `AccountRequestActions`: version-aware Admin controls for processing, completing, or rejecting export/deletion requests with a mandatory resolution.
- `NotificationAdminPanel`: bounded template editor, product-announcement composer, delivery counters, recent announcements, and payload-free job diagnostics.
- `/admin/notifications`: Admin/Super Admin notification operations; Moderators have no notification administration permission.
- `/admin/message-safety`: aggregate messaging operations view for Admin/Super Admin with safe report links and an explicit no-raw-conversation privacy boundary.
- `/admin/users`: responsive, searchable, paginated operational user review for Admin and Super Admin.
- `/admin/users/[id]`: safe profile/account review with audiences, account requests, and bounded audit history; secrets and raw Prisma objects are excluded.
- `UserStatusActions`: Module 17 status control (`ACTIVE`/`SUSPENDED`/`DEACTIVATED` with a required reason) and an independent "revoke all sessions" action, gated on `USER_MANAGE` and hidden on the actor's own account.
- The Admin route group includes responsive loading skeletons, a retryable generic error boundary, a non-disclosing not-found surface, and an explicit permission-denied page for authenticated operations staff.
- The mobile drawer exposes the existing Admin destination to authorized staff without changing the five-item bottom navigation.

### Explore Your City

- `CityHubView`: reusable premium city landing surface with a city narrative, city signals, section cards, and Kondo impact framing.
- `CitySectionView`: reusable detail surface for company, product, university, opportunity, event, service, and city-story collections.
- `ExploreIcon`: constrained icon and accent-token mapper shared across registered cities; content records never import presentation components.
- Explore pages are Server Components backed by the typed city registry. Only the compact dropdown requires client-side state.

### Onboarding

- `OnboardingShell`: the shared frame for both onboarding flows. Aura background, one card, a single progress language (`Step X of Y` plus a segmented bar), and a sticky action bar that stays reachable above the mobile keyboard and the home indicator.
- `fields.tsx`: the onboarding field kit — `TextField`, `DateField`, `TextAreaField`, `ChoiceChips`, `ChoiceCards`, `MultiSelectField`, `TogglePills`, `TokenField`, plus `FieldSection`/`FieldGrid` for grouping. Labels are associated with `htmlFor`; hints are `aria-describedby`, never part of the accessible name.
- `OnboardingFlow`: three steps — journey, journey-specific details, focus. Gender and country of origin are collected at registration and only asked here when the account genuinely lacks them (organization operators, legacy accounts). Each Continue saves a validated draft; completed members can reopen the flow and save changes.
- `OrganizationOnboardingFlow`: three steps — identity, profile (activity areas, introduction and contact on one screen), review. Shares `OnboardingShell` with the personal flow.
- Step completion rules live in `src/lib/onboarding-requirements.ts` and return the sentence shown next to the primary action, so a disabled button always states what is missing.

### Help center

- `QuestionComposer`: validated question creation and redirect to the new knowledge page.
- `AnswerComposer`: inline answer creation with error recovery.
- `HelpfulButton`: persisted optimistic helpful voting with rollback.

## Page surfaces

- Public: landing, register, login.
- Identity: onboarding and profile.
- Engagement: personalized home, communities, community detail, paginated private messages with protected attachments, notifications, and global search.
- Utility: marketplace/listing detail, Student Hub, guide library/guide detail, help center/question detail, Explore city hub/section detail, complete settings sections, and persisted language preference.
- Operations: Admin/Super Admin overview, role-scoped report queue and case detail, Admin/Super Admin AuditLog browser, reference-data CMS, and media inspection/removal.

## Accessibility contract

- Controls use semantic buttons/links, accessible names, focus-visible rings, and `aria-current`, `aria-expanded`, or `aria-pressed` where state matters.
- Color is not the only state signal.
- Mobile targets are at least 40–48 px for primary navigation.
- Motion is subtle and disabled through `prefers-reduced-motion`.
- Text and interface surfaces use high-contrast light/dark pairs.

## Component contribution rule

Before creating a component, check the UI primitives and feature folder for a composable match. New variants belong in shared primitives; domain behavior belongs in the relevant feature folder. Avoid introducing a second button, card, avatar, or navigation system.
