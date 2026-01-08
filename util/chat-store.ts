import type { MyUIMessage } from '@/util/chat-schema';

export type ChatRecord = {
  id: string;
  messages: MyUIMessage[];
  activeStreamId: string | null;
  canceledAt?: number | null;
};

const chats = new Map<string, ChatRecord>();

export async function readChat(id: string): Promise<ChatRecord> {
  const existing = chats.get(id);

  if (existing) return existing;

  const fresh: ChatRecord = {
    id,
    messages: [],
    activeStreamId: null,
    canceledAt: null,
  };

  chats.set(id, fresh);
  return fresh;
}

export async function saveChat(chat: ChatRecord): Promise<void> {
  chats.set(chat.id, chat);
}

/**
 * Optional: call this when user hits "Stop" (later).
 */
export async function cancelChat(id: string): Promise<void> {
  const chat = await readChat(id);
  chats.set(id, { ...chat, canceledAt: Date.now() });
}
