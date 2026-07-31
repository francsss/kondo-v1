import { describe, expect, it } from "vitest";
import {
  mergeConversationMessages,
  messagesBelongToSameGroup,
} from "@/features/messages/presentation";
import { directConversationKey } from "@/lib/messaging";

describe("direct conversation identity", () => {
  it("uses the same key regardless of which user starts the conversation", () => {
    expect(directConversationKey("user-b", "user-a")).toBe("user-a:user-b");
    expect(directConversationKey("user-a", "user-b")).toBe("user-a:user-b");
  });
});

describe("conversation presentation", () => {
  it("groups consecutive messages from the same sender within five minutes", () => {
    const first = {
      senderId: "user-a",
      createdAt: "2026-07-31T10:00:00.000Z",
    };
    expect(
      messagesBelongToSameGroup(first, {
        senderId: "user-a",
        createdAt: "2026-07-31T10:04:59.000Z",
      }),
    ).toBe(true);
    expect(
      messagesBelongToSameGroup(first, {
        senderId: "user-b",
        createdAt: "2026-07-31T10:01:00.000Z",
      }),
    ).toBe(false);
    expect(
      messagesBelongToSameGroup(first, {
        senderId: "user-a",
        createdAt: "2026-07-31T10:06:00.000Z",
      }),
    ).toBe(false);
  });

  it("merges polling windows without duplicates and keeps chronological order", () => {
    const merged = mergeConversationMessages(
      [
        { id: "b", createdAt: "2026-07-31T10:02:00.000Z" },
        { id: "a", createdAt: "2026-07-31T10:01:00.000Z" },
      ],
      [
        { id: "b", createdAt: "2026-07-31T10:02:00.000Z" },
        { id: "c", createdAt: "2026-07-31T10:03:00.000Z" },
      ],
    );
    expect(merged.map(({ id }) => id)).toEqual(["a", "b", "c"]);
  });
});
