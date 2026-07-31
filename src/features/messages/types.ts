export type MessageParticipant = {
  id: string;
  firstName: string;
  lastName: string;
  avatarMediaId: string | null;
};

export type MessageAttachment = {
  id: string | null;
  kind: "IMAGE" | "DOCUMENT";
  name: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  altText: string | null;
  url: string | null;
  available: boolean;
};

export type ConversationMessage = {
  id: string;
  clientMessageId: string | null;
  senderId: string;
  type: "TEXT" | "IMAGE" | "DOCUMENT";
  body: string | null;
  attachment: MessageAttachment | null;
  editedAt: string | null;
  createdAt: string;
  sender: MessageParticipant;
};

export type SentMessagePayload = Omit<ConversationMessage, "sender">;

export type ConversationMessageWindow = {
  messages: ConversationMessage[];
  hasMore: boolean;
};
