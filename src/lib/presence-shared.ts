export const PRESENCE_HEARTBEAT_MS = 5 * 60 * 1_000;
export const PRESENCE_ONLINE_WINDOW_MS = 7 * 60 * 1_000;

export type PresenceSnapshot = {
  userId: string;
  firstName: string;
  lastName: string;
  avatarMediaId: string | null;
  role: string;
  city: string | null;
  university: string | null;
  country: string | null;
  currentPath: string;
  currentPage: string;
  connectedAt: string;
  lastSeen: string;
  device: string;
  browser: string;
  operatingSystem: string;
};

export function getEstimatedSessionRange(
  connectedAt: Date | string,
  now: Date = new Date(),
) {
  const elapsedMs = Math.max(
    0,
    now.getTime() - new Date(connectedAt).getTime(),
  );
  const lowerMinutes =
    Math.floor(elapsedMs / PRESENCE_HEARTBEAT_MS) *
    (PRESENCE_HEARTBEAT_MS / 60_000);
  return {
    lowerMinutes,
    upperMinutes: lowerMinutes + PRESENCE_HEARTBEAT_MS / 60_000,
    label: `${lowerMinutes}–${lowerMinutes + 5} min`,
  };
}
