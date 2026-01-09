// db/store.ts - In-memory store (replace with Postgres/D1 later)
import type { Tenant, Agent, Chat, Message } from '@/types';

// ============================================
// IN-MEMORY STORES
// ============================================
const tenants = new Map<string, Tenant>();
const agents = new Map<string, Agent>();
const chats = new Map<string, Chat>();
const messages = new Map<string, Message[]>(); // chatId -> messages

// ============================================
// SEED DATA - Demo tenant and agents
// ============================================
export function seedDemoData() {
  // Demo Tenant
  const demoTenant: Tenant = {
    id: 'tenant_demo',
    name: 'Demo Company',
    slug: 'demo',
    plan: 'pro',
    settings: {
      maxAgents: 5,
      maxChatsPerMonth: 1000,
      customBranding: true,
      allowedModels: ['gpt-4o-mini', 'gpt-4o', 'claude-sonnet-4-20250514'],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  tenants.set(demoTenant.id, demoTenant);

  // Support Agent
  const supportAgent: Agent = {
    id: 'agent_support',
    tenantId: demoTenant.id,
    name: 'Support Bot',
    slug: 'support',
    description: 'Customer support assistant',
    config: {
      model: 'gpt-4o-mini',
      systemPrompt: `You are a helpful customer support assistant for Demo Company. 
You help users with their questions about products, orders, and account issues.
Be friendly, professional, and concise. If you don't know something, say so honestly.`,
      temperature: 0.7,
      maxTokens: 1024,
      welcomeMessage: 'Hi! 👋 How can I help you today?',
      fallbackMessage: "I'm not sure I understand. Could you rephrase that?",
      theme: {
        primaryColor: '#3B82F6',
        chatBubbleStyle: 'rounded',
      },
    },
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  agents.set(supportAgent.id, supportAgent);

  // Sales Agent
  const salesAgent: Agent = {
    id: 'agent_sales',
    tenantId: demoTenant.id,
    name: 'Sales Bot',
    slug: 'sales',
    description: 'Sales qualification assistant',
    config: {
      model: 'gpt-4o',
      systemPrompt: `You are a sales assistant for Demo Company.
Your goal is to understand customer needs, answer product questions, and qualify leads.
Be enthusiastic but not pushy. Ask clarifying questions to understand their requirements.
Always try to book a demo or connect them with a sales rep when appropriate.`,
      temperature: 0.8,
      maxTokens: 2048,
      welcomeMessage: "Hello! 🚀 Interested in our solutions? I'd love to help!",
      theme: {
        primaryColor: '#10B981',
        chatBubbleStyle: 'rounded',
      },
    },
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  agents.set(salesAgent.id, salesAgent);

  // Internal Ops Agent (draft)
  const opsAgent: Agent = {
    id: 'agent_ops',
    tenantId: demoTenant.id,
    name: 'Internal Ops',
    slug: 'ops',
    description: 'Internal operations assistant (draft)',
    config: {
      model: 'gpt-4o-mini',
      systemPrompt: 'You are an internal operations assistant. Help employees with HR questions, IT issues, and company policies.',
      temperature: 0.5,
      maxTokens: 1024,
    },
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  agents.set(opsAgent.id, opsAgent);

  console.log('✅ Seeded demo data: 1 tenant, 3 agents');
}

// ============================================
// TENANT OPERATIONS
// ============================================
export const TenantStore = {
  getById(id: string): Tenant | undefined {
    return tenants.get(id);
  },

  getBySlug(slug: string): Tenant | undefined {
    return Array.from(tenants.values()).find(t => t.slug === slug);
  },

  getAll(): Tenant[] {
    return Array.from(tenants.values());
  },

  create(tenant: Tenant): Tenant {
    tenants.set(tenant.id, tenant);
    return tenant;
  },

  update(id: string, updates: Partial<Tenant>): Tenant | undefined {
    const tenant = tenants.get(id);
    if (!tenant) return undefined;
    const updated = { ...tenant, ...updates, updatedAt: new Date() };
    tenants.set(id, updated);
    return updated;
  },
};

// ============================================
// AGENT OPERATIONS
// ============================================
export const AgentStore = {
  getById(id: string): Agent | undefined {
    return agents.get(id);
  },

  getBySlug(tenantId: string, slug: string): Agent | undefined {
    return Array.from(agents.values()).find(
      a => a.tenantId === tenantId && a.slug === slug
    );
  },

  getByTenant(tenantId: string): Agent[] {
    return Array.from(agents.values()).filter(a => a.tenantId === tenantId);
  },

  create(agent: Agent): Agent {
    agents.set(agent.id, agent);
    return agent;
  },

  update(id: string, updates: Partial<Agent>): Agent | undefined {
    const agent = agents.get(id);
    if (!agent) return undefined;
    const updated = { ...agent, ...updates, updatedAt: new Date() };
    agents.set(id, updated);
    return updated;
  },

  delete(id: string): boolean {
    return agents.delete(id);
  },
};

// ============================================
// CHAT OPERATIONS
// ============================================
export const ChatStore = {
  getById(id: string): Chat | undefined {
    return chats.get(id);
  },

  getByAgent(agentId: string): Chat[] {
    return Array.from(chats.values()).filter(c => c.agentId === agentId);
  },

  getByTenant(tenantId: string): Chat[] {
    return Array.from(chats.values()).filter(c => c.tenantId === tenantId);
  },

  create(chat: Chat): Chat {
    chats.set(chat.id, chat);
    messages.set(chat.id, []); // Initialize empty message array
    return chat;
  },

  update(id: string, updates: Partial<Chat>): Chat | undefined {
    const chat = chats.get(id);
    if (!chat) return undefined;
    const updated = { ...chat, ...updates, updatedAt: new Date() };
    chats.set(id, updated);
    return updated;
  },
};

// ============================================
// MESSAGE OPERATIONS
// ============================================
export const MessageStore = {
  getByChatId(chatId: string): Message[] {
    return messages.get(chatId) || [];
  },

  add(chatId: string, message: Message): Message {
    const chatMessages = messages.get(chatId) || [];
    chatMessages.push(message);
    messages.set(chatId, chatMessages);
    ChatStore.update(chatId, { updatedAt: new Date() }); // keep chat fresh
    return message;
  },

  has(chatId: string, messageId: string): boolean {
    return (messages.get(chatId) || []).some(m => m.id === messageId);
  },
};

// ============================================
// ISOLATION CHECK - Verify tenant access
// ============================================
export function verifyTenantAccess(tenantId: string, resourceTenantId: string): boolean {
  return tenantId === resourceTenantId;
}

export function verifyAgentAccess(tenantId: string, agentId: string): Agent | null {
  const agent = AgentStore.getById(agentId);
  if (!agent || agent.tenantId !== tenantId) {
    return null;
  }
  return agent;
}

export function verifyChatAccess(tenantId: string, chatId: string): Chat | null {
  const chat = ChatStore.getById(chatId);
  if (!chat || chat.tenantId !== tenantId) {
    return null;
  }
  return chat;
}
// Call this from server components / routes before reading the store
export function ensureDemoSeeded() {
  // Seed only once (Next dev / Turbopack can reload modules)
  if (TenantStore.getAll().length === 0) {
      seedDemoData();
  }
}



// Initialize with demo data
seedDemoData();