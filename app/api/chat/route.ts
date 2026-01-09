// app/api/chat/route.ts - Chat endpoint with RAG integration
import { streamText, convertToModelMessages, generateId } from 'ai';
import type { UIMessage } from 'ai';
import { AgentStore } from '@/db/store';
import { getModel } from '@/lib/models';
import { 
  retrieveContext, 
  augmentSystemPrompt, 
  extractRagMetadata, 
  isRagEnabled,
  extractUserQuery 
} from '@/lib/knowledge';
import type { RagContext } from '@/types';

type Trigger = 'submit-message' | 'regenerate-message';

type ChatState = {
  messages: UIMessage[];
};

const CHAT_DB = new Map<string, ChatState>();

function keyOf(tenantId: string, agentId: string, chatId: string) {
  return `${tenantId}:${agentId}:${chatId}`;
}

function getChat(tenantId: string, agentId: string, chatId: string): ChatState {
  const key = keyOf(tenantId, agentId, chatId);
  const existing = CHAT_DB.get(key);
  if (existing) return existing;

  const created: ChatState = { messages: [] };
  CHAT_DB.set(key, created);
  return created;
}

function makeSystemUIMessage(text: string): UIMessage {
  return {
    id: generateId(),
    role: 'system',
    parts: [{ type: 'text', text }],
  } as UIMessage;
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const tenantId = String(body.tenantId ?? '');
  const agentId = String(body.agentId ?? '');
  const chatId = String(body.chatId ?? body.id ?? '');

  if (!tenantId || !agentId || !chatId) {
    return Response.json(
      { error: 'Missing tenantId, agentId, or chatId (or id).' },
      { status: 400 },
    );
  }

  const agent = AgentStore.getById(agentId);
  if (!agent) return Response.json({ error: 'Agent not found' }, { status: 404 });
  if (agent.tenantId !== tenantId) {
    return Response.json({ error: 'Agent does not belong to tenant' }, { status: 403 });
  }

  const chat = getChat(tenantId, agentId, chatId);
  let messages: UIMessage[] = Array.isArray(chat.messages) ? chat.messages : [];

  // Support BOTH formats:
  // A) DefaultChatTransport: { id, trigger, message, messageId }
  // B) Simple: { messages: UIMessage[] }
  if (Array.isArray(body.messages)) {
    messages = body.messages;
  } else {
    const trigger: Trigger = (body.trigger ?? 'submit-message') as Trigger;
    const messageId: string | undefined = body.messageId ?? undefined;
    const message: UIMessage | undefined = body.message ?? undefined;

    if (trigger === 'submit-message') {
      if (!message) {
        return Response.json({ error: 'Missing message for submit-message' }, { status: 400 });
      }

      if (messageId != null) {
        const idx = messages.findIndex(m => m.id === messageId);
        if (idx === -1) return Response.json({ error: `message ${messageId} not found` }, { status: 400 });

        messages = messages.slice(0, idx);
        messages.push(message);
      } else {
        messages = [...messages, message];
      }
    }

    if (trigger === 'regenerate-message') {
      const idx =
        messageId == null
          ? messages.length - 1
          : messages.findIndex(m => m.id === messageId);

      if (idx === -1) return Response.json({ error: `message ${messageId} not found` }, { status: 400 });

      messages = messages.slice(0, messages[idx].role === 'assistant' ? idx : idx + 1);
    }
  }

  // Save updated messages before generation
  chat.messages = messages;

  // ============================================
  // RAG: Retrieve relevant context from knowledge base
  // ============================================
  let ragContext: RagContext = { chunks: [], totalTokensEstimate: 0 };
  
  if (isRagEnabled(agent)) {
    try {
      const userQuery = extractUserQuery(messages);
      
      if (userQuery) {
        ragContext = await retrieveContext(
          userQuery,
          tenantId,
          agentId,
          agent.config.ragSettings,
          agent.config.knowledgeSourceIds
        );
        
        if (ragContext.chunks.length > 0) {
          console.log(`🔍 RAG: Found ${ragContext.chunks.length} relevant chunks (~${ragContext.totalTokensEstimate} tokens)`);
        }
      }
    } catch (error) {
      // Log but don't fail the request if RAG fails
      console.error('RAG retrieval error:', error);
    }
  }

  // Build system prompt (with RAG context if available)
  let systemPrompt = agent.config.systemPrompt?.trim() || '';
  
  if (ragContext.chunks.length > 0) {
    systemPrompt = augmentSystemPrompt(systemPrompt, ragContext, agent.config.ragSettings);
  }

  const runtimeMessages = systemPrompt
    ? [makeSystemUIMessage(systemPrompt), ...messages]
    : messages;

  const model = getModel(agent.config.model);

  const result = streamText({
    model,
    temperature: agent.config.temperature,
    maxTokens: agent.config.maxTokens,
    messages: await convertToModelMessages(runtimeMessages),
  });

  // Extract RAG metadata to include in response
  const ragSources = ragContext.chunks.length > 0 
    ? extractRagMetadata(ragContext) 
    : undefined;

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId: generateId,
    messageMetadata: ({ part }) => {
      if (part.type === 'start') {
        return {
          createdAt: Date.now(),
          tenantId,
          agentId,
          chatId,
          // Include RAG sources in message metadata
          ragSources,
        };
      }
    },
    onFinish: ({ messages: finalMessages }) => {
      chat.messages = finalMessages;
    },
  });
}