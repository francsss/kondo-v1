INSERT INTO "NotificationTemplate"
("key", "type", "titleTemplate", "bodyTemplate", "isActive", "version", "createdAt", "updatedAt")
VALUES
(
  'ACCOUNT_WELCOME',
  'ACCOUNT',
  'Welcome to Kondo, {{firstName}} 👋',
  'Let''s personalize your student experience.',
  true,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'ONBOARDING_REMINDER',
  'ACCOUNT',
  'Complete your Kondo profile',
  'Discover communities, opportunities and students around you.',
  true,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'COMMUNITY_POST',
  'COMMUNITY_ACTIVITY',
  '{{actorName}} shared a post in {{communityName}}',
  '{{preview}}',
  true,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'COMMUNITY_DAILY_SUMMARY',
  'COMMUNITY_ACTIVITY',
  '{{communityName}} has new discussions',
  '{{count}} useful updates were shared in the last day.',
  true,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'COMMUNITY_MEMBER_SUMMARY',
  'COMMUNITY_ACTIVITY',
  'New students joined {{communityName}}',
  '{{count}} new students joined in the last day.',
  true,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'MEET_MATCHES',
  'MEET_ACTIVITY',
  'New student connections near {{areaName}}',
  '{{count}} students match your {{intention}} preferences.',
  true,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'ACADEMIC_CLASS_REMINDER',
  'ACADEMIC',
  '{{courseName}} starts in {{minutes}} minutes',
  '{{location}}',
  true,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'ACADEMIC_IMPORT_READY',
  'ACADEMIC',
  'Your timetable is ready to review',
  '{{courseCount}} courses were extracted. Review them before saving.',
  true,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'SCHOLARSHIP_MATCH',
  'RECOMMENDATION',
  'A scholarship matches your profile',
  '{{scholarshipTitle}} · Check the eligibility and deadline.',
  true,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'MARKETPLACE_NEARBY',
  'RECOMMENDATION',
  'A student nearby posted something useful',
  '{{listingTitle}} is now available around {{cityName}}.',
  true,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
