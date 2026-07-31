const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function messageDayKey(value: string | Date) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function messagesBelongToSameGroup(
  first: { senderId: string; createdAt: string | Date } | undefined,
  second: { senderId: string; createdAt: string | Date } | undefined,
) {
  if (!first || !second || first.senderId !== second.senderId) return false;
  const firstTime = new Date(first.createdAt).getTime();
  const secondTime = new Date(second.createdAt).getTime();
  return (
    messageDayKey(first.createdAt) === messageDayKey(second.createdAt) &&
    Math.abs(secondTime - firstTime) <= GROUP_WINDOW_MS
  );
}

export function mergeConversationMessages<
  T extends { id: string; createdAt: string },
>(current: T[], incoming: T[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((first, second) => {
    const firstTime = new Date(first.createdAt).getTime();
    const secondTime = new Date(second.createdAt).getTime();
    return firstTime - secondTime || first.id.localeCompare(second.id);
  });
}
