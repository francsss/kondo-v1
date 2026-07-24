INSERT INTO "NotificationTemplate"
("key", "type", "titleTemplate", "bodyTemplate", "isActive", "version", "updatedAt")
VALUES
(
    'COMMUNITY_REQUEST_HELP',
    'COMMUNITY_ANNOUNCEMENT',
    '{{actorName}} can help',
    'Your request “{{requestTitle}}” received a new offer of help.',
    true,
    1,
    CURRENT_TIMESTAMP
),
(
    'COMMUNITY_REQUEST_CLOSED',
    'COMMUNITY_ANNOUNCEMENT',
    'Community request resolved',
    '“{{requestTitle}}” has been marked as closed.',
    true,
    1,
    CURRENT_TIMESTAMP
);
