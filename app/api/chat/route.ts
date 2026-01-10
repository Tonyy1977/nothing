// app/api/chat/route.ts - Multi-tenant chat API (Phase 2 Complete)
import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { getModel } from '@/lib/models';
import { 
  TenantStore, 
  AgentStore, 
  ChatStore, 
  MessageStore, 
  verifyAgentAccess 
} from '@/db/store';
import type { Chat, Message, MessagePart } from '@/types';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      messages, 
      tenantId, 
      agentId, 
      chatId 
    }: { 
      messages: Array<{ id?: string; role: string; content?: string; parts?: MessagePart[] }>;
      tenantId: string;
      agentId: string;
      chatId?: string;
    } = body;

    console.log('📥 Chat request:', { tenantId, agentId, chatId, messageCount: messages?.length });

    // ============================================
    // 1. VALIDATE TENANT EXISTS
    // ============================================
    const tenant = TenantStore.getById(tenantId);
    if (!tenant) {
      console.error('❌ Tenant not found:', tenantId);
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // 2. VALIDATE AGENT + TENANT OWNERSHIP
    // ============================================
    const agent = verifyAgentAccess(tenantId, agentId);
    if (!agent) {
      console.error('❌ Agent access denied:', { tenantId, agentId });
      return new Response(
        JSON.stringify({ error: 'Agent not found or access denied' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check agent is active
    if (agent.status !== 'active') {
      console.error('❌ Agent not active:', agent.status);
      return new Response(
        JSON.stringify({ error: `Agent is ${agent.status}, not accepting requests` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // 3. ENFORCE TENANT PLAN RULES
    // ============================================
    // Check if model is allowed for this tenant's plan
    if (!tenant.settings.allowedModels.includes(agent.config.model)) {
      console.error('❌ Model not allowed:', agent.config.model, 'allowed:', tenant.settings.allowedModels);
      return new Response(
        JSON.stringify({ 
          error: `Model ${agent.config.model} not available on ${tenant.plan} plan`,
          allowedModels: tenant.settings.allowedModels,
          upgradeRequired: true
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // TODO: Check chat quota (tenant.settings.maxChatsPerMonth)
    // const monthlyChats = ChatStore.countByTenantThisMonth(tenantId);
    // if (monthlyChats >= tenant.settings.maxChatsPerMonth) { ... }

    // ============================================
    // 4. GET OR CREATE CHAT
    // ============================================
    let chat: Chat;
    let isNewChat = false;

    if (chatId) {
      const existingChat = ChatStore.getById(chatId);
      if (!existingChat) {
        // Create chat with provided ID
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
        console.log('✨ Created new chat with provided ID:', chat.id);
      } else if (existingChat.tenantId !== tenantId || existingChat.agentId !== agentId) {
        console.error('❌ Chat access denied:', { chatId, existingTenant: existingChat.tenantId, requestTenant: tenantId });
        return new Response(
          JSON.stringify({ error: 'Chat not found or access denied' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      } else {
        chat = existingChat;
      }
    } else {
      // Create new chat with generated ID
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
      console.log('✨ Created new chat:', chat.id);
    }

    // ============================================
    // 5. VALIDATE & CONVERT MESSAGES
    // ============================================
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No messages provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Convert to UIMessage format
    const uiMessages: UIMessage[] = messages.map((msg) => {
      if (msg.parts && Array.isArray(msg.parts)) {
        return msg as UIMessage;
      }
      return {
        id: msg.id || crypto.randomUUID(),
        role: msg.role as 'user' | 'assistant' | 'system',
        parts: [{ type: 'text', text: String(msg.content || '') }],
      } as UIMessage;
    });

    // ============================================
    // 6. PERSIST USER MESSAGE
    // ============================================
    const lastUserMessage = uiMessages.filter(m => m.role === 'user').pop();
    if (lastUserMessage) {
      const userMsg: Message = {
        id: lastUserMessage.id,
        chatId: chat.id,
        role: 'user',
        parts: lastUserMessage.parts as MessagePart[],
        createdAt: new Date(),
      };
      MessageStore.add(chat.id, userMsg);
      console.log('💾 Saved user message:', userMsg.id);
    }

    // ============================================
    // 7. GET MODEL FROM AGENT CONFIG
    // ============================================
    const model = getModel(agent.config.model);
    console.log('🤖 Agent config:', {
      name: agent.name,
      model: agent.config.model,
      temperature: agent.config.temperature,
      maxTokens: agent.config.maxTokens,
      promptPreview: agent.config.systemPrompt.slice(0, 50) + '...',
    });

    // ============================================
    // 8. STREAM RESPONSE WITH AGENT CONFIG
    // ============================================
    const result = streamText({
      model,
      system: agent.config.systemPrompt,  // FROM AGENT CONFIG
      messages: await convertToModelMessages(uiMessages),
      temperature: agent.config.temperature,  // FROM AGENT CONFIG
      maxTokens: agent.config.maxTokens,  // FROM AGENT CONFIG
    });

    // ============================================
    // 9. RETURN STREAM WITH PERSISTENCE ON FINISH
    // ============================================
    return result.toUIMessageStreamResponse({
      onFinish: async ({ response }) => {
        // Persist assistant message
        const assistantMsg: Message = {
          id: `msg_${crypto.randomUUID().slice(0, 12)}`,
          chatId: chat.id,
          role: 'assistant',
          parts: [{ type: 'text', text: response.messages[0]?.content?.toString() || '' }],
          metadata: {
            model: agent.config.model,
          },
          createdAt: new Date(),
        };
        MessageStore.add(chat.id, assistantMsg);
        console.log('💾 Saved assistant message:', assistantMsg.id);

        // Update chat timestamp
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
    console.error('❌ Chat API Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('Stack:', errorStack);
    
    if (errorMessage.includes('API key') || errorMessage.includes('apiKey')) {
      return new Response(
        JSON.stringify({ error: 'Model API key not configured. Check your .env.local file.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Failed to process chat request', details: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}