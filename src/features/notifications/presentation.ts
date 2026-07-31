export type KondoNotificationCategory =
  | "messages"
  | "friends"
  | "communities"
  | "events"
  | "marketplace"
  | "housing"
  | "opportunities"
  | "schedule"
  | "transfers"
  | "university"
  | "security"
  | "system";

export type KondoNotificationKind =
  | "NEW_MESSAGE"
  | "FRIEND_REQUEST"
  | "FRIEND_REQUEST_ACCEPTED"
  | "COMMUNITY_ANNOUNCEMENT"
  | "NEW_EVENT"
  | "EVENT_REMINDER"
  | "MARKETPLACE_ACTIVITY"
  | "HOUSING_ACTIVITY"
  | "OPPORTUNITY_ACTIVITY"
  | "NEW_COMMENT"
  | "REACTION"
  | "SCHEDULE_REMINDER"
  | "UPCOMING_CLASS"
  | "ASSIGNMENT_REMINDER"
  | "EXAM_REMINDER"
  | "UNIVERSITY_ANNOUNCEMENT"
  | "PAYMENT_COMPLETED"
  | "TRANSFER_RECEIVED"
  | "TRANSFER_COMPLETED"
  | "SECURITY_ALERT"
  | "NEW_DEVICE_LOGIN"
  | "SYSTEM_UPDATE";

export type NotificationIconName =
  | "message"
  | "friend"
  | "community"
  | "event"
  | "marketplace"
  | "housing"
  | "opportunity"
  | "comment"
  | "reaction"
  | "schedule"
  | "assignment"
  | "exam"
  | "university"
  | "payment"
  | "transfer"
  | "security"
  | "device"
  | "system";

export type NotificationPresentation = {
  kind: KondoNotificationKind;
  category: KondoNotificationCategory;
  categoryLabel: string;
  icon: NotificationIconName;
  actionLabel: string;
};

const PRESENTATIONS: Record<KondoNotificationKind, NotificationPresentation> = {
  NEW_MESSAGE: {
    kind: "NEW_MESSAGE",
    category: "messages",
    categoryLabel: "Messages",
    icon: "message",
    actionLabel: "Open chat",
  },
  FRIEND_REQUEST: {
    kind: "FRIEND_REQUEST",
    category: "friends",
    categoryLabel: "Friends",
    icon: "friend",
    actionLabel: "View request",
  },
  FRIEND_REQUEST_ACCEPTED: {
    kind: "FRIEND_REQUEST_ACCEPTED",
    category: "friends",
    categoryLabel: "Friends",
    icon: "friend",
    actionLabel: "View profile",
  },
  COMMUNITY_ANNOUNCEMENT: {
    kind: "COMMUNITY_ANNOUNCEMENT",
    category: "communities",
    categoryLabel: "Communities",
    icon: "community",
    actionLabel: "Open community",
  },
  NEW_EVENT: {
    kind: "NEW_EVENT",
    category: "events",
    categoryLabel: "Events",
    icon: "event",
    actionLabel: "View event",
  },
  EVENT_REMINDER: {
    kind: "EVENT_REMINDER",
    category: "events",
    categoryLabel: "Events",
    icon: "event",
    actionLabel: "View event",
  },
  MARKETPLACE_ACTIVITY: {
    kind: "MARKETPLACE_ACTIVITY",
    category: "marketplace",
    categoryLabel: "Marketplace",
    icon: "marketplace",
    actionLabel: "View listing",
  },
  HOUSING_ACTIVITY: {
    kind: "HOUSING_ACTIVITY",
    category: "housing",
    categoryLabel: "Housing",
    icon: "housing",
    actionLabel: "Open Housing",
  },
  OPPORTUNITY_ACTIVITY: {
    kind: "OPPORTUNITY_ACTIVITY",
    category: "opportunities",
    categoryLabel: "Opportunities",
    icon: "opportunity",
    actionLabel: "Open opportunity",
  },
  NEW_COMMENT: {
    kind: "NEW_COMMENT",
    category: "communities",
    categoryLabel: "Comments",
    icon: "comment",
    actionLabel: "View comment",
  },
  REACTION: {
    kind: "REACTION",
    category: "communities",
    categoryLabel: "Reactions",
    icon: "reaction",
    actionLabel: "View activity",
  },
  SCHEDULE_REMINDER: {
    kind: "SCHEDULE_REMINDER",
    category: "schedule",
    categoryLabel: "Schedule",
    icon: "schedule",
    actionLabel: "View schedule",
  },
  UPCOMING_CLASS: {
    kind: "UPCOMING_CLASS",
    category: "schedule",
    categoryLabel: "Upcoming class",
    icon: "schedule",
    actionLabel: "View schedule",
  },
  ASSIGNMENT_REMINDER: {
    kind: "ASSIGNMENT_REMINDER",
    category: "schedule",
    categoryLabel: "Assignments",
    icon: "assignment",
    actionLabel: "View assignment",
  },
  EXAM_REMINDER: {
    kind: "EXAM_REMINDER",
    category: "schedule",
    categoryLabel: "Exams",
    icon: "exam",
    actionLabel: "View schedule",
  },
  UNIVERSITY_ANNOUNCEMENT: {
    kind: "UNIVERSITY_ANNOUNCEMENT",
    category: "university",
    categoryLabel: "University",
    icon: "university",
    actionLabel: "View announcement",
  },
  PAYMENT_COMPLETED: {
    kind: "PAYMENT_COMPLETED",
    category: "transfers",
    categoryLabel: "Payments",
    icon: "payment",
    actionLabel: "View receipt",
  },
  TRANSFER_RECEIVED: {
    kind: "TRANSFER_RECEIVED",
    category: "transfers",
    categoryLabel: "Transfers",
    icon: "transfer",
    actionLabel: "View transfer",
  },
  TRANSFER_COMPLETED: {
    kind: "TRANSFER_COMPLETED",
    category: "transfers",
    categoryLabel: "Transfers",
    icon: "transfer",
    actionLabel: "View transfer",
  },
  SECURITY_ALERT: {
    kind: "SECURITY_ALERT",
    category: "security",
    categoryLabel: "Security",
    icon: "security",
    actionLabel: "Review security",
  },
  NEW_DEVICE_LOGIN: {
    kind: "NEW_DEVICE_LOGIN",
    category: "security",
    categoryLabel: "Security",
    icon: "device",
    actionLabel: "Review device",
  },
  SYSTEM_UPDATE: {
    kind: "SYSTEM_UPDATE",
    category: "system",
    categoryLabel: "Kondo",
    icon: "system",
    actionLabel: "View update",
  },
};

const TEMPLATE_KIND: Record<string, KondoNotificationKind> = {
  MESSAGE_NEW: "NEW_MESSAGE",
  POST_COMMENT: "NEW_COMMENT",
  QNA_REPLY: "NEW_COMMENT",
  MARKETPLACE_CONTACT: "MARKETPLACE_ACTIVITY",
  MARKETPLACE_NEARBY: "MARKETPLACE_ACTIVITY",
  MODERATION_RESULT: "SECURITY_ALERT",
  ADMIN_ANNOUNCEMENT: "SYSTEM_UPDATE",
  COMMUNITY_REQUEST_HELP: "COMMUNITY_ANNOUNCEMENT",
  COMMUNITY_REQUEST_CLOSED: "COMMUNITY_ANNOUNCEMENT",
  ACCOUNT_WELCOME: "SYSTEM_UPDATE",
  ONBOARDING_REMINDER: "SYSTEM_UPDATE",
  COMMUNITY_POST: "COMMUNITY_ANNOUNCEMENT",
  COMMUNITY_DAILY_SUMMARY: "COMMUNITY_ANNOUNCEMENT",
  COMMUNITY_MEMBER_SUMMARY: "COMMUNITY_ANNOUNCEMENT",
  MEET_MATCHES: "FRIEND_REQUEST",
  ACADEMIC_CLASS_REMINDER: "UPCOMING_CLASS",
  ACADEMIC_IMPORT_READY: "SCHEDULE_REMINDER",
  SCHOLARSHIP_MATCH: "UNIVERSITY_ANNOUNCEMENT",
  ORGANIZATION_INVITATION: "SYSTEM_UPDATE",
  ORGANIZATION_INVITATION_ACCEPTED: "SYSTEM_UPDATE",
  ORGANIZATION_ROLE_CHANGED: "SECURITY_ALERT",
  ORGANIZATION_MEMBER_REMOVED: "SECURITY_ALERT",
  ORGANIZATION_OWNERSHIP_TRANSFER: "SECURITY_ALERT",
  ORGANIZATION_VERIFICATION_UPDATE: "SECURITY_ALERT",
  ORGANIZATION_STATUS_UPDATE: "SECURITY_ALERT",
  HOUSING_LISTING_STATUS: "HOUSING_ACTIVITY",
  HOUSING_INQUIRY: "HOUSING_ACTIVITY",
  HOUSING_REQUEST_MATCH: "HOUSING_ACTIVITY",
  ROOMMATE_INTEREST: "HOUSING_ACTIVITY",
  ROOMMATE_INTEREST_UPDATE: "HOUSING_ACTIVITY",
  OPPORTUNITY_PUBLISHED: "OPPORTUNITY_ACTIVITY",
  OPPORTUNITY_DEADLINE_REMINDER: "OPPORTUNITY_ACTIVITY",
  OPPORTUNITY_APPLICATION_SUBMITTED: "OPPORTUNITY_ACTIVITY",
  OPPORTUNITY_NEW_APPLICATION: "OPPORTUNITY_ACTIVITY",
  OPPORTUNITY_APPLICATION_STATUS: "OPPORTUNITY_ACTIVITY",
  OPPORTUNITY_INTERVIEW_INVITATION: "OPPORTUNITY_ACTIVITY",
  OPPORTUNITY_APPLICANT_RESPONSE: "OPPORTUNITY_ACTIVITY",
  OPPORTUNITY_MODERATION_RESULT: "OPPORTUNITY_ACTIVITY",
};

const TYPE_KIND: Record<string, KondoNotificationKind> = {
  ACCOUNT: "SYSTEM_UPDATE",
  MESSAGE: "NEW_MESSAGE",
  COMMENT: "NEW_COMMENT",
  REPLY: "NEW_COMMENT",
  MARKETPLACE_UPDATE: "MARKETPLACE_ACTIVITY",
  HOUSING: "HOUSING_ACTIVITY",
  OPPORTUNITY: "OPPORTUNITY_ACTIVITY",
  COMMUNITY_ANNOUNCEMENT: "COMMUNITY_ANNOUNCEMENT",
  COMMUNITY_ACTIVITY: "COMMUNITY_ANNOUNCEMENT",
  MEET_ACTIVITY: "FRIEND_REQUEST",
  ACADEMIC: "SCHEDULE_REMINDER",
  RECOMMENDATION: "UNIVERSITY_ANNOUNCEMENT",
  MODERATION_UPDATE: "SECURITY_ALERT",
};

/**
 * Preference column that silences a category which NotificationType alone cannot
 * express, so the newer toggles in Settings → Notifications actually bite. This
 * gate is deliberately additive: categories already covered by the type-level
 * rules in `preferenceAllows` map to null so their delivery behaviour is
 * unchanged, and so do `security` and `system`, because safety alerts and
 * account notices stay deliverable even when everything else is muted. That is
 * why Settings renders Security as always-on instead of an empty promise.
 */
export const CATEGORY_PREFERENCE_FIELD = {
  friends: "notificationFriends",
  events: "notificationEvents",
  transfers: "notificationTransfers",
  university: "notificationUniversity",
  messages: null,
  communities: null,
  marketplace: null,
  housing: "notificationHousing",
  opportunities: "notificationOpportunities",
  schedule: null,
  security: null,
  system: null,
} as const satisfies Record<KondoNotificationCategory, string | null>;

export type NotificationCategoryPreferenceField = Exclude<
  (typeof CATEGORY_PREFERENCE_FIELD)[KondoNotificationCategory],
  null
>;

export function notificationPresentation(input: {
  type: string;
  templateKey?: string | null;
  kind?: string | null;
}) {
  const explicitKind =
    input.kind && input.kind in PRESENTATIONS
      ? (input.kind as KondoNotificationKind)
      : null;
  const kind =
    explicitKind ??
    (input.templateKey ? TEMPLATE_KIND[input.templateKey] : undefined) ??
    TYPE_KIND[input.type] ??
    "SYSTEM_UPDATE";
  return PRESENTATIONS[kind];
}

export function allNotificationPresentations() {
  return Object.values(PRESENTATIONS);
}
