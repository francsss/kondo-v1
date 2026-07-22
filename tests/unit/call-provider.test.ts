import { decodeJwt } from "jose";
import { afterEach, describe, expect, it } from "vitest";
import { callMediaProvider, isLiveKitConfigured } from "@/lib/calls/provider";

const original = {
  url: process.env.LIVEKIT_URL,
  key: process.env.LIVEKIT_API_KEY,
  secret: process.env.LIVEKIT_API_SECRET,
};

afterEach(() => {
  for (const [key, value] of [
    ["LIVEKIT_URL", original.url],
    ["LIVEKIT_API_KEY", original.key],
    ["LIVEKIT_API_SECRET", original.secret],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("LiveKit call provider", () => {
  it("mints a short-lived token restricted to one room and identity", async () => {
    process.env.LIVEKIT_URL = "wss://kondo-test.livekit.cloud";
    process.env.LIVEKIT_API_KEY = "kondo-test-key";
    process.env.LIVEKIT_API_SECRET =
      "a-test-secret-that-is-long-enough-for-signing";

    expect(isLiveKitConfigured()).toBe(true);
    const access = await callMediaProvider.createParticipantAccess({
      roomName: "room-under-test",
      userId: "user-under-test",
      displayName: "Test User",
    });
    const claims = decodeJwt(access.token);
    const video = claims.video as { room?: string; roomJoin?: boolean };
    expect(claims.sub).toBe("user-under-test");
    expect(video.room).toBe("room-under-test");
    expect(video.roomJoin).toBe(true);
    const secondsRemaining = (claims.exp ?? 0) - Math.floor(Date.now() / 1000);
    expect(secondsRemaining).toBeGreaterThan(290);
    expect(secondsRemaining).toBeLessThanOrEqual(300);
    expect(access.serverUrl).toBe("wss://kondo-test.livekit.cloud");
  });
});
