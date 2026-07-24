import { describe, expect, it } from "vitest";
import { usesImmersiveAppShell } from "@/lib/app-shell";

describe("usesImmersiveAppShell", () => {
  it("uses the immersive shell for community details and conversations", () => {
    expect(usesImmersiveAppShell("/communities/housing-roommates")).toBe(true);
    expect(usesImmersiveAppShell("/messages/conversation-id")).toBe(true);
  });

  it("keeps platform navigation on community lists and management pages", () => {
    expect(usesImmersiveAppShell("/communities")).toBe(false);
    expect(usesImmersiveAppShell("/communities/housing-roommates/manage")).toBe(
      false,
    );
    expect(usesImmersiveAppShell("/home")).toBe(false);
  });
});
