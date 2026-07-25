# Kondo Pet — temporary MVP feedback assistant

Kondo Pet is a feedback collection surface, not a chatbot. It is mounted at
the two existing application-shell boundaries (`AppShell` and the isolated
`StudentHubShell`) and decides whether to render from the current route.

## Runtime behavior

- Eligible areas: Home, Communities, Explore, Marketplace, and Student Hub.
- The mascot appears only after seven seconds without user activity.
- It remains visible for nine seconds and appears once per product area during
  a browser session.
- A successful submission pauses future appearances for seven days.
- Reduced-motion preferences disable decorative movement and shorten the
  success transition.
- The feature is disabled globally by setting
  `NEXT_PUBLIC_KONDO_PET_ENABLED=false` and redeploying.

No navigation entry or page-level integration is required. The module can
therefore be removed or replaced without modifying the eligible features.

## Data and privacy

Member feedback is stored in `PetFeedback`; internal staff notes are stored in
`PetFeedbackNote`. Message content remains in Kondo and is never included in
PostHog events. Administrative status and note changes are recorded in the
audit log.

The public submission endpoint requires authentication, a trusted same-origin
request, schema validation, and rate limiting. Administrative endpoints use
the dedicated `FEEDBACK_VIEW` and `FEEDBACK_MANAGE` permissions.

## Product analytics

The client emits:

- `pet_displayed`
- `pet_clicked`
- `feedback_modal_opened`
- `feedback_submitted`
- `feedback_cancelled`

Only stable route/area metadata, category, completion duration, and interaction
state are captured. The provisioning script creates the
`Kondo · MVP feedback` PostHog dashboard for click-through, conversion, and
completion-time measurement.
