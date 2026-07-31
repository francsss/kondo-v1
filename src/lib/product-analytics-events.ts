export const PRODUCT_EVENTS = {
  PAGE_VIEWED: "$pageview",
  LANDING_VIEWED: "landing_viewed",
  JOIN_CLICKED: "join_clicked",
  LOGIN_CLICKED: "login_clicked",
  LOGIN_STARTED: "login_started",
  LOGIN_COMPLETED: "login_completed",
  REGISTRATION_STARTED: "registration_started",
  REGISTRATION_STEP_REACHED: "registration_form_step_reached",
  REGISTRATION_INTENT_SELECTED: "registration_intent_selected",
  REGISTRATION_VALIDATION_ERROR: "registration_validation_error",
  REGISTRATION_COMPLETED: "registration_completed",
  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_STEP_REACHED: "onboarding_step_reached",
  ONBOARDING_STEP_COMPLETED: "onboarding_step_completed",
  ONBOARDING_VALIDATION_ERROR: "onboarding_validation_error",
  ONBOARDING_COMPLETED: "onboarding_completed",
  PERSONAL_JOURNEY_SELECTED: "personal_journey_selected",
  ORGANIZATION_ONBOARDING_STARTED: "organization_onboarding_started",
  ORGANIZATION_DRAFT_CREATED: "organization_draft_created",
  ORGANIZATION_ONBOARDING_COMPLETED: "organization_onboarding_completed",
  ORGANIZATION_WORKSPACE_OPENED: "organization_workspace_opened",
  ORGANIZATION_PROFILE_UPDATED: "organization_profile_updated",
  ORGANIZATION_CAPABILITIES_UPDATED: "organization_capabilities_updated",
  ORGANIZATION_INVITATION_SENT: "organization_invitation_sent",
  ORGANIZATION_INVITATION_ACCEPTED: "organization_invitation_accepted",
  ORGANIZATION_INVITATION_DECLINED: "organization_invitation_declined",
  ORGANIZATION_MEMBER_ROLE_CHANGED: "organization_member_role_changed",
  ORGANIZATION_MEMBER_REMOVED: "organization_member_removed",
  ORGANIZATION_OWNERSHIP_TRANSFER_REQUESTED:
    "organization_ownership_transfer_requested",
  ORGANIZATION_OWNERSHIP_TRANSFER_COMPLETED:
    "organization_ownership_transfer_completed",
  ORGANIZATION_VERIFICATION_DRAFT_SAVED:
    "organization_verification_draft_saved",
  ORGANIZATION_VERIFICATION_SUBMITTED: "organization_verification_submitted",
  ORGANIZATION_VERIFICATION_REVIEWED: "organization_verification_reviewed",
  ORGANIZATION_LIFECYCLE_CHANGED: "organization_lifecycle_changed",
  ORGANIZATION_PARTNER_STATUS_CHANGED: "organization_partner_status_changed",
  ORGANIZATION_PUBLIC_PROFILE_PREVIEWED:
    "organization_public_profile_previewed",
  ORGANIZATION_PUBLIC_PROFILE_PUBLISHED:
    "organization_public_profile_published",
  ORGANIZATION_PUBLIC_PROFILE_UNPUBLISHED:
    "organization_public_profile_unpublished",
  ORGANIZATION_PUBLIC_PROFILE_VIEWED: "organization_public_profile_viewed",
  ORGANIZATION_DIRECTORY_VIEWED: "organization_directory_viewed",
  ORGANIZATION_DIRECTORY_FILTERED: "organization_directory_filtered",
  ORGANIZATION_SEARCH_RESULT_OPENED: "organization_search_result_opened",
  ORGANIZATION_CONTACT_OPENED: "organization_contact_opened",
  ORGANIZATION_WEBSITE_OPENED: "organization_website_opened",
  ORGANIZATION_SHARED: "organization_shared",
  ORGANIZATION_REPORT_STARTED: "organization_report_started",
  ORGANIZATION_REPORT_SUBMITTED: "organization_report_submitted",
  ORGANIZATION_GALLERY_OPENED: "organization_gallery_opened",
  ORGANIZATION_CITY_CONTEXT_OPENED: "organization_city_context_opened",
  HOME_ARRIVED_AFTER_ONBOARDING: "home_arrived_after_onboarding",
  FEATURE_TIME_SPENT: "feature_time_spent",
  COMMUNITY_OPENED: "community_opened",
  COMMUNITY_CREATED: "community_created",
  COMMUNITY_JOINED: "community_joined",
  COMMUNITY_LEFT: "community_left",
  COMMUNITY_POST_PUBLISHED: "community_post_published",
  COMMUNITY_POST_REACTED: "community_post_reacted",
  COMMUNITY_COMMENT_CREATED: "community_comment_created",
  COMMUNITY_REPLY_CREATED: "community_reply_created",
  COMMUNITY_POST_SHARED: "community_post_shared",
  MEET_OPENED: "meet_opened",
  MEET_PROFILE_VIEWED: "meet_profile_viewed",
  MEET_LIKED: "meet_liked",
  MEET_MATCHED: "meet_matched",
  MEET_CONVERSATION_STARTED: "meet_conversation_started",
  CONVERSATION_CREATED: "conversation_created",
  MESSAGE_SENT: "message_sent",
  MESSAGE_IMAGE_SENT: "message_image_sent",
  MARKETPLACE_OPENED: "marketplace_opened",
  MARKETPLACE_LISTING_PUBLISHED: "marketplace_listing_published",
  MARKETPLACE_LISTING_VIEWED: "marketplace_listing_viewed",
  MARKETPLACE_LISTING_SAVED: "marketplace_listing_saved",
  MARKETPLACE_VENDOR_CONTACTED: "marketplace_vendor_contacted",
  HOUSING_HOME_VIEWED: "housing_home_viewed",
  HOUSING_SEARCH_STARTED: "housing_search_started",
  HOUSING_FILTER_APPLIED: "housing_filter_applied",
  HOUSING_MAP_OPENED: "housing_map_opened",
  HOUSING_LISTING_VIEWED: "housing_listing_viewed",
  HOUSING_LISTING_SAVED: "housing_listing_saved",
  HOUSING_LISTING_SHARED: "housing_listing_shared",
  HOUSING_CONTACT_OPENED: "housing_contact_opened",
  HOUSING_INQUIRY_STARTED: "housing_inquiry_started",
  HOUSING_INQUIRY_SENT: "housing_inquiry_sent",
  HOUSING_LISTING_CREATION_STARTED: "housing_listing_creation_started",
  HOUSING_LISTING_SUBMITTED: "housing_listing_submitted",
  HOUSING_LISTING_PUBLISHED: "housing_listing_published",
  HOUSING_REQUEST_CREATED: "housing_request_created",
  HOUSING_REQUEST_VIEWED: "housing_request_viewed",
  ROOMMATE_PROFILE_CREATED: "roommate_profile_created",
  ROOMMATE_DISCOVERY_VIEWED: "roommate_discovery_viewed",
  ROOMMATE_INTEREST_SENT: "roommate_interest_sent",
  ROOMMATE_INTEREST_ACCEPTED: "roommate_interest_accepted",
  HOUSING_RECOMMENDATION_OPENED: "housing_recommendation_opened",
  HOUSING_REPORT_SUBMITTED: "housing_report_submitted",
  STUDENT_HUB_OPENED: "student_hub_opened",
  STUDENT_HUB_TOOL_SELECTED: "student_hub_tool_selected",
  STUDENT_HUB_FILE_IMPORT_STARTED: "student_hub_file_import_started",
  STUDENT_HUB_FILE_IMPORT_SUCCEEDED: "student_hub_file_import_succeeded",
  STUDENT_HUB_FILE_IMPORT_FAILED: "student_hub_file_import_failed",
  STUDENT_HUB_GENERATION_STARTED: "student_hub_generation_started",
  STUDENT_HUB_GENERATION_SUCCEEDED: "student_hub_generation_succeeded",
  STUDENT_HUB_GENERATION_FAILED: "student_hub_generation_failed",
  STUDENT_HUB_TOOL_TIME_SPENT: "student_hub_tool_time_spent",
  EXPLORE_CITY_OPENED: "explore_city_opened",
  EXPLORE_CATEGORY_OPENED: "explore_category_opened",
  EXPLORE_COMPANY_VIEWED: "explore_company_viewed",
  EXPLORE_INTERNSHIP_VIEWED: "explore_internship_viewed",
  EXPLORE_RESTAURANT_VIEWED: "explore_restaurant_viewed",
  EXPLORE_HOUSING_VIEWED: "explore_housing_viewed",
  EXPLORE_EVENT_VIEWED: "explore_event_viewed",
  EXPLORE_CONTACT_CLICKED: "explore_contact_clicked",
  NOTIFICATIONS_RECEIVED: "notifications_received",
  NOTIFICATION_OPENED: "notification_opened",
  NOTIFICATION_ACTIONED: "notification_actioned",
  STORY_OPENED: "story_opened",
  STORY_STARTED: "story_started",
  STORY_COMPLETED: "story_completed",
  STORY_SKIPPED: "story_skipped",
  STORY_LIKED: "story_liked",
  STORY_UNLIKED: "story_unliked",
  STORY_COMMENTED: "story_commented",
  STORY_SHARED: "story_shared",
  STORY_SAVED: "story_saved",
  STORY_UNSAVED: "story_unsaved",
  STORY_REPORTED: "story_reported",
  STORY_ENTITY_CLICKED: "story_entity_clicked",
  CREATOR_PROFILE_OPENED: "creator_profile_opened",
  CREATOR_FOLLOWED: "creator_followed",
  PUBLISH_REQUEST_STARTED: "publish_request_started",
  PUBLISH_REQUEST_SUBMITTED: "publish_request_submitted",
  PUBLISH_REQUEST_REVISION_REQUESTED: "publish_request_revision_requested",
  PUBLISH_REQUEST_RESUBMITTED: "publish_request_resubmitted",
  PUBLISH_REQUEST_APPROVED: "publish_request_approved",
  PUBLISH_REQUEST_REJECTED: "publish_request_rejected",
  OFFICIAL_PROFILE_OPENED: "official_profile_opened",
  OFFICIAL_MARK_CLICKED: "official_mark_clicked",
  VERIFICATION_INFO_OPENED: "verification_info_opened",
  VERIFICATION_REQUEST_STARTED: "verification_request_started",
  VERIFICATION_REQUEST_SUBMITTED: "verification_request_submitted",
  VERIFICATION_REQUEST_MORE_INFO_REQUESTED:
    "verification_request_more_info_requested",
  VERIFICATION_REQUEST_APPROVED: "verification_request_approved",
  VERIFICATION_REQUEST_REJECTED: "verification_request_rejected",
  OFFICIAL_STATUS_SUSPENDED: "official_status_suspended",
  OFFICIAL_STATUS_REVOKED: "official_status_revoked",
  OFFICIAL_PROFILE_REPORTED: "official_profile_reported",
  PET_DISPLAYED: "pet_displayed",
  PET_CLICKED: "pet_clicked",
  FEEDBACK_MODAL_OPENED: "feedback_modal_opened",
  FEEDBACK_SUBMITTED: "feedback_submitted",
  FEEDBACK_CANCELLED: "feedback_cancelled",
  JAVASCRIPT_ERROR: "javascript_error",
  API_REQUEST_SLOW: "api_request_slow",
  API_REQUEST_FAILED: "api_request_failed",
  PAGE_PERFORMANCE_SLOW: "page_performance_slow",
  UPLOAD_FAILED: "upload_failed",
  GUIDE_STARTED: "guide_started",
  GUIDE_STEP_COMPLETED: "guide_step_completed",
  SEARCH_PERFORMED: "search_performed",
  SESSION_STARTED: "session_started",
} as const;

export type ProductEventName =
  (typeof PRODUCT_EVENTS)[keyof typeof PRODUCT_EVENTS];

export type ProductEventProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

const REDACTED_PROPERTY_NAMES = new Set([
  "email",
  "message",
  "message_content",
  "content",
  "password",
  "token",
  "file_name",
  "filename",
  "search_query",
]);

export function sanitizeProductProperties(
  properties: ProductEventProperties = {},
) {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(
        ([key, value]) =>
          !REDACTED_PROPERTY_NAMES.has(key.toLowerCase()) &&
          value !== undefined &&
          (value === null ||
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"),
      )
      .map(([key, value]) => [
        key.slice(0, 80),
        typeof value === "string" ? value.slice(0, 160) : value,
      ]),
  );
}

const DYNAMIC_ROUTE_PATTERNS: Array<[RegExp, string]> = [
  [
    /^\/organizations\/[^/]+\/(dashboard|profile|team|verification|activity|settings)/,
    "/organizations/[organization]/[workspace-section]",
  ],
  [
    /^\/organization-invitations\/[^/]+/,
    "/organization-invitations/[invitation]",
  ],
  [/^\/messages\/[^/]+/, "/messages/[conversation]"],
  [/^\/profile\/[^/]+/, "/profile/[member]"],
  [/^\/stories\/[^/]+/, "/stories/[story-action]"],
  [/^\/communities\/[^/]+\/manage/, "/communities/[community]/manage"],
  [/^\/communities\/[^/]+/, "/communities/[community]"],
  [/^\/marketplace\/[^/]+\/edit/, "/marketplace/[listing]/edit"],
  [/^\/marketplace\/[^/]+/, "/marketplace/[listing]"],
  [/^\/housing\/listings\/[^/]+/, "/housing/listings/[listing]"],
  [/^\/housing\/roommates\/[^/]+/, "/housing/roommates/[profile]"],
  [/^\/housing\/requests\/[^/]+/, "/housing/requests/[request]"],
  [/^\/housing\/manage\/[^/]+/, "/housing/manage/[listing]"],
  [/^\/guides\/[^/]+/, "/guides/[guide]"],
  [/^\/help\/[^/]+/, "/help/[question]"],
  [/^\/api\/conversations\/[^/]+/, "/api/conversations/[conversation]"],
  [/^\/api\/student-hub\/imports\/[^/]+/, "/api/student-hub/imports/[import]"],
  [/^\/api\/media\/uploads\/[^/]+/, "/api/media/uploads/[upload]"],
  [/^\/api\/communities\/[^/]+/, "/api/communities/[community]"],
  [/^\/api\/posts\/[^/]+/, "/api/posts/[post]"],
  [/^\/api\/marketplace\/[^/]+/, "/api/marketplace/[listing]"],
  [/^\/api\/housing\/listings\/[^/]+/, "/api/housing/listings/[listing]"],
  [
    /^\/api\/housing\/roommate-interests\/[^/]+/,
    "/api/housing/roommate-interests/[interest]",
  ],
  [/^\/api\/notifications\/[^/]+/, "/api/notifications/[notification]"],
  [/^\/api\/stories\/[^/]+/, "/api/stories/[story]"],
];

export function normalizeAnalyticsRoute(input: string) {
  let pathname = "/";
  try {
    pathname = new URL(input, "https://kondo.invalid").pathname;
  } catch {
    pathname = input.split(/[?#]/, 1)[0] || "/";
  }
  for (const [pattern, replacement] of DYNAMIC_ROUTE_PATTERNS) {
    if (pattern.test(pathname)) return replacement;
  }
  return pathname.slice(0, 240);
}

export function productAreaForPath(pathname: string) {
  if (pathname.startsWith("/communities")) return "communities";
  if (pathname.startsWith("/housing")) return "housing";
  if (pathname.startsWith("/marketplace")) return "marketplace";
  if (
    pathname.startsWith("/student-hub") ||
    pathname.startsWith("/guides") ||
    pathname.startsWith("/help")
  )
    return "student_hub";
  if (pathname.startsWith("/messages")) return "messages";
  if (pathname.startsWith("/explore")) return "explore";
  if (pathname.startsWith("/notifications")) return "notifications";
  if (pathname.startsWith("/stories")) return "student_stories";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/settings")) return "settings";
  if (
    pathname.startsWith("/organizations") ||
    pathname.startsWith("/organization-invitations")
  )
    return "organizations";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname === "/home") return "home";
  if (pathname === "/") return "landing";
  if (pathname === "/register") return "registration";
  if (pathname === "/login") return "login";
  if (pathname.startsWith("/onboarding")) return "onboarding";
  return "other";
}
