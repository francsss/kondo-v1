export type HomeActivityType =
  | "MEMBER_JOINED"
  | "POST_CREATED"
  | "COMMENT_CREATED"
  | "COMMUNITY_JOINED"
  | "COMMUNITY_CREATED"
  | "CITY_HUB_PUBLISHED"
  | "LISTING_CREATED"
  | "EVENT_UPCOMING"
  | "FOLLOW_CREATED"
  | "BADGE_EARNED";

export type HomeActivityActor = {
  id: string;
  firstName: string;
  lastName: string;
  avatarMediaId: string | null;
  countryEmoji: string | null;
};

export type HomeActivityItem = {
  id: string;
  type: HomeActivityType;
  occurredAt: string;
  actor: HomeActivityActor | null;
  action: string;
  subject: string | null;
  detail: string | null;
  href: string;
};
