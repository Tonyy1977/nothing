// app/api/chat/route.ts - Multi-tenant chat API (Phase 2)
import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { getModel } from '@/lib/models';
import {
  TenantStore,
  ChatStore,
  MessageStore,
  verifyAgentAccess,
  ensureDemoSeeded,
} from '@/db/store';
import type { ChatRequest, Chat, Message, MessagePart } from '@/types';

export const maxDuration = 30;

function toTextParts(content: string): MessagePart[] {
  return [{ type: 'text', text: content }];
}

export async function POST(req: Request) {
  try {
    ensureDemoSeeded();

    const body = (await req.json().catch(() => null)) as ChatRequest | null;
    if (!body) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { messages, tenantId, agentId, chatId } = body;

    if (!tenantId || !agentId) {
      return new Response(JSON.stringify({ error: 'tenantId and agentId are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1) Validate tenant
    const tenant = TenantStore.getById(tenantId);
    if (!tenant) {
      return new Response(JSON.stringify({ error: 'Tenant not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2) Validate agent ownership
    const agent = verifyAgentAccess(tenantId, agentId);
    if (!agent) {
      return new Response(JSON.stringify({ error: 'Agent not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (agent.status !== 'active') {
      return new Response(JSON.stringify({ error: `Agent is ${agent.status}, not accepting requests` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3) Enforce plan allowed models
    if (!tenant.settings.allowedModels.includes(agent.config.model)) {
      return new Response(
        JSON.stringify({
          error: `Model ${agent.config.model} not available on ${tenant.plan} plan`,
          allowedModels: tenant.settings.allowedModels,
          upgradeRequired: true,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // 4) Get or create chat
    let chat: Chat;
    let isNewChat = false;

    if (chatId) {
      const existing = ChatStore.getById(chatId);
      if (!existing) {
        chat = ChatStore.create({
          id: chatId,
          tenantId,
          agentId,
          status: 'active',
          metadata: { source: 'api' },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        isNewChat = true;
      } else if (existing.tenantId !== tenantId || existing.agentId !== agentId) {
        return new Response(JSON.stringify({ error: 'Chat not found or access denied' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        chat = existing;
      }
    } else {
      chat = ChatStore.create({
        id: `chat_${crypto.randomUUID().slice(0, 12)}`,
        tenantId,
        agentId,
        status: 'active',
        metadata: { source: 'api' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      isNewChat = true;
    }

    // 5) Convert incoming messages to UIMessage
    const uiMessages: UIMessage[] = messages.map((m) => {
      const id = m.id ?? crypto.randomUUID();
      if (Array.isArray(m.parts)) {
        return { id, role: m.role, parts: m.parts } as UIMessage;
      }
      return {
        id,
        role: m.role,
        parts: toTextParts(String(m.content ?? '')),
      } as UIMessage;
    });

    // 6) Persist NEW user messages only (dedupe by message.id)
    const existingIds = new Set(MessageStore.getByChatId(chat.id).map((mm) => mm.id));

    const newUserMessages = uiMessages
      .filter((m) => m.role === 'user')
      .filter((m) => !existingIds.has(m.id))
      .map(
        (m): Message => ({
          id: m.id,
          chatId: chat.id,
          role: 'user',
          parts: (m.parts ?? toTextParts('')) as MessagePart[],
          createdAt: new Date(),
        }),
      );

    if (newUserMessages.length > 0) {
      MessageStore.addMany(chat.id, newUserMessages);
      ChatStore.update(chat.id, { updatedAt: new Date() });
    }

    // 7) Get model from agent config
    const model = getModel(agent.config.model);

    // 8) Stream response
    const result = streamText({
      model,
      system: agent.config.systemPrompt,
      messages: await convertToModelMessages(uiMessages),
      temperature: agent.config.temperature,
      maxTokens: agent.config.maxTokens,
    });

    // 9) Return stream + persist assistant on finish
    return result.toUIMessageStreamResponse({
      onFinish: async ({ messages: finishedMessages }) => {
        const finalAssistant = [...finishedMessages].reverse().find((m) => m.role === 'assistant');
        if (!finalAssistant) return;

        const existingNow = new Set(MessageStore.getByChatId(chat.id).map((mm) => mm.id));
        if (existingNow.has(finalAssistant.id)) return; // dedupe

        const assistantMsg: Message = {
          id: finalAssistant.id,
          chatId: chat.id,
          role: 'assistant',
          parts: (finalAssistant.parts ?? toTextParts(finalAssistant.content ?? '')) as MessagePart[],
          metadata: { model: agent.config.model },
          createdAt: new Date(),
        };

        MessageStore.add(chat.id, assistantMsg);
        ChatStore.update(chat.id, { updatedAt: new Date() });
      },
      headers: {
        'X-Chat-Id': chat.id,
        'X-Agent-Id': agent.id,
        'X-Tenant-Id': tenantId,
        'X-Is-New-Chat': isNewChat ? 'true' : 'false',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: 'Failed to process chat request', details: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
