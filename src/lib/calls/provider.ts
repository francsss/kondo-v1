import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

export type CallAccess = {
  token: string;
  serverUrl: string;
  expiresInSeconds: number;
};

export interface CallMediaProvider {
  prepareRoom(input: { roomName: string }): Promise<void>;
  createParticipantAccess(input: {
    roomName: string;
    userId: string;
    displayName: string;
  }): Promise<CallAccess>;
  closeRoom(roomName: string): Promise<void>;
}

function liveKitConfig() {
  const serverUrl = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!serverUrl || !apiKey || !apiSecret) {
    throw new Error("LiveKit is not configured on this server.");
  }
  if (!/^wss:\/\//i.test(serverUrl)) {
    throw new Error("LIVEKIT_URL must be a secure WebSocket URL (wss://). ");
  }
  return { serverUrl, apiKey, apiSecret };
}

function roomService() {
  const config = liveKitConfig();
  const apiUrl = new URL(config.serverUrl);
  apiUrl.protocol = "https:";
  return new RoomServiceClient(
    apiUrl.toString(),
    config.apiKey,
    config.apiSecret,
  );
}

class LiveKitCallProvider implements CallMediaProvider {
  async prepareRoom(input: { roomName: string }) {
    await roomService().createRoom({
      name: input.roomName,
      emptyTimeout: 5 * 60,
      departureTimeout: 30,
      maxParticipants: 2,
      metadata: JSON.stringify({ provider: "kondo", version: 1 }),
    });
  }

  async createParticipantAccess(input: {
    roomName: string;
    userId: string;
    displayName: string;
  }) {
    const config = liveKitConfig();
    const expiresInSeconds = 5 * 60;
    const token = new AccessToken(config.apiKey, config.apiSecret, {
      identity: input.userId,
      name: input.displayName,
      ttl: expiresInSeconds,
      metadata: JSON.stringify({ provider: "kondo", version: 1 }),
    });
    token.addGrant({
      room: input.roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    });
    return {
      token: await token.toJwt(),
      serverUrl: config.serverUrl,
      expiresInSeconds,
    };
  }

  async closeRoom(roomName: string) {
    await roomService().deleteRoom(roomName);
  }
}

export const callMediaProvider: CallMediaProvider = new LiveKitCallProvider();

export function isLiveKitConfigured() {
  try {
    liveKitConfig();
    return true;
  } catch {
    return false;
  }
}
