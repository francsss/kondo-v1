# Student Stories and Official Profiles

## Existing Kondo systems reused

- `AppShell` owns the unchanged primary navigation and the existing mobile
  drawer. `ExploreMenu` owns the secondary overflow menu.
- Prisma and PostgreSQL remain the source of truth for identity, moderation,
  permissions and content status.
- The existing `MediaAsset` pipeline provides signed R2 uploads, validation,
  ownership, attachment tracking, audit logs and delivery.
- The generic `Report`, `Notification`, `AuditLog`, rate-limit and PostHog
  layers are extended instead of duplicated.
- Kondo UI primitives (`Card`, `Button`, `Avatar`, `MediaImage`) and the
  current design tokens are used throughout.

## Information architecture

- `/stories` is the immersive, useful-video reader.
- `/stories/submit` is the member submission and revision workspace.
- `/admin/stories` is the category, creator and moderation workspace.
- `/settings/official-profile` contains the confidential verification request.
- Student Stories appears in the existing secondary menu and mobile drawer;
  the five primary-navigation items and their order do not change.
- Compact contextual rails can open a story from Home, city, community and
  profile pages. The origin URL and browser scroll history are preserved.

## MVP decisions

- Videos are MP4 files, limited to 25 MB and 180 seconds. R2 serves them with
  native byte-range support. The active story is loaded eagerly, while only
  neighboring Story metadata is prepared. Distant and off-screen players are
  paused and unloaded.
- Kondo has no video transcoder or adaptive-streaming service today. The MVP
  therefore validates the MP4 container and duration but does not promise
  multiple quality renditions. A later media worker can add HLS/DASH without
  changing the Story domain model.
- City, university and community links use real foreign keys. Companies,
  internships and events currently live inside versioned City Hub JSON rather
  than first-class tables; compatible contextual links are stored only when a
  real Kondo URL exists. No duplicate entity records are introduced.
- Ranking is deterministic and explainable: featured/official importance,
  city, university, joined-community relevance, language, recency, editorial
  quality and diversity. Popularity is a secondary signal.
- Every member may submit. Admins, ambassadors, approved creators and Trusted
  Creators have server-controlled publishing privileges. Trusted Creator and
  Official Profile remain separate concepts.

## Primary user journeys

1. A member opens a compact contextual rail or the secondary menu, watches a
   relevant story, follows a Kondo entity call to action, then returns without
   losing page or scroll context.
2. A member uploads a video and optional poster, adds useful metadata and
   submits it to moderation. Changes requested by a moderator can be revised
   and resubmitted.
3. A moderator reviews the video and its entity links, then approves, requests
   changes, rejects, schedules, publishes or removes it. Every transition is
   audited.
4. An organization submits confidential evidence for an Official Profile.
   Authorized administrators review it and the public mark only appears while
   the server-side status is `APPROVED`.

## Accessibility, privacy and resilience

- Reader controls have labels and keyboard alternatives; swipe is never the
  only navigation method. Reduced-motion and data-saver preferences disable
  nonessential motion/autoplay.
- Captions, poster-first loading, retry, empty, removed and offline states are
  explicit. Videos outside the viewport do not keep playing.
- Verification documents use private media delivery and are visible only to
  the applicant and authorized administrators.
- PostHog events contain identifiers and product context only; document names,
  comment text, verification evidence and other sensitive content are excluded.

## Deferred production improvements

- Adaptive renditions, automatic poster extraction, resumable multipart
  uploads, automated speech-to-caption generation and media privacy detection
  require a dedicated asynchronous video-processing worker.
- Following creators is deferred because Kondo has no existing follow graph.
- First-class company, internship and event Story relations should be added
  when those City Hub records become relational models.
