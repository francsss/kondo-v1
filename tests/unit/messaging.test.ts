import { describe, expect, it } from "vitest";
import { directConversationKey } from "@/lib/messaging";

describe("direct conversation identity", () => {
  it("uses the same key regardless of which user starts the conversation", () => {
    expect(directConversationKey("user-b", "user-a")).toBe("user-a:user-b");
    expect(directConversationKey("user-a", "user-b")).toBe("user-a:user-b");
  });
});
