import { describe, expect, it } from "vitest";
import { usesImmersiveAppShell } from "@/lib/app-shell";

describe("usesImmersiveAppShell", () => {
  it("uses the immersive shell for community details and conversations", () => {
    expect(usesImmersiveAppShell("/communities/housing-roommates")).toBe(true);
    expect(usesImmersiveAppShell("/messages/conversation-id")).toBe(true);
    expect(usesImmersiveAppShell("/stories")).toBe(true);
    // A marketplace thread is the same conversation shell. Without this the
    // mobile quick-nav floats over the composer and swallows the send button.
    expect(usesImmersiveAppShell("/marketplace/messages/conversation-id")).toBe(
      true,
    );
  });

  it("keeps platform navigation on community lists and management pages", () => {
    expect(usesImmersiveAppShell("/communities")).toBe(false);
    expect(usesImmersiveAppShell("/communities/housing-roommates/manage")).toBe(
      false,
    );
    expect(usesImmersiveAppShell("/home")).toBe(false);
    expect(usesImmersiveAppShell("/stories/submit")).toBe(false);
    expect(usesImmersiveAppShell("/stories/report")).toBe(false);
    // The Marketplace inbox is an ordinary page and keeps its navigation.
    expect(usesImmersiveAppShell("/marketplace/messages")).toBe(false);
    expect(usesImmersiveAppShell("/marketplace")).toBe(false);
  });
});
