// types/index.ts - Core types for multi-tenant AI SaaS

// ============================================
// 1️⃣ TENANT - The company/customer
// ============================================
export interface Tenant {
  id: string;
  name: string;
  slug: string; // URL-friendly: "ddt-enterprise"
  plan: 'free' | 'pro' | 'enterprise';
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantSettings {
  maxAgents: number;
  maxChatsPerMonth: number;
  customBranding: boolean;
  allowedModels: ModelId[];
}

// ============================================
// 2️⃣ AGENT - The chatbot
// ============================================
export interface Agent {
  id: string;
  tenantId: string; // Foreign key to tenant
  name: string;
  slug: string; // "support-bot"
  description?: string;
  config: AgentConfig;
  status: 'active' | 'inactive' | 'draft';
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentConfig {
  // Core LLM settings
  model: ModelId;
  systemPrompt: string;
  temperature: number; // 0-1
  maxTokens: number;
  
  // Behavior
  welcomeMessage?: string;
  fallbackMessage?: string;
  
  // UI customization
  theme?: AgentTheme;
  
  // Future: tools, knowledge sources
  // tools?: string[];
  // knowledgeSourceIds?: string[];
}

export interface AgentTheme {
  primaryColor: string;
  avatarUrl?: string;
  chatBubbleStyle: 'rounded' | 'square';
}

// ============================================
// 3️⃣ CHAT - The conversation
// ============================================
export interface Chat {
  id: string;
  tenantId: string; // Denormalized for fast queries
  agentId: string;
  visitorId?: string; // Anonymous visitor tracking
  metadata?: ChatMetadata;
  status: 'active' | 'closed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMetadata {
  source?: 'widget' | 'page' | 'api';
  userAgent?: string;
  referrer?: string;
  customData?: Record<string, unknown>;
}

// ============================================
// MESSAGE - Individual chat messages
// ============================================
export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];
  metadata?: MessageMetadata;
  createdAt: Date;
}

export type MessagePart = 
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool-invocation'; toolCallId: string; toolName: string; args: unknown; result?: unknown }
  | { type: 'source'; sourceType: 'url' | 'document'; url?: string; title?: string };

export interface MessageMetadata {
  model?: string;
  tokenUsage?: { prompt: number; completion: number; total: number };
  latencyMs?: number;
}

// ============================================
// SUPPORTED MODELS
// ============================================
export type ModelId = 
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'claude-sonnet-4-20250514'
  | 'claude-3-5-haiku-20241022'
  | 'gemini-2.0-flash';

export const MODEL_INFO: Record<ModelId, { name: string; provider: 'openai' | 'anthropic' | 'google'; contextWindow: number }> = {
  'gpt-4o': { name: 'GPT-4o', provider: 'openai', contextWindow: 128000 },
  'gpt-4o-mini': { name: 'GPT-4o Mini', provider: 'openai', contextWindow: 128000 },
  'gpt-4-turbo': { name: 'GPT-4 Turbo', provider: 'openai', contextWindow: 128000 },
  'claude-sonnet-4-20250514': { name: 'Claude Sonnet 4', provider: 'anthropic', contextWindow: 200000 },
  'claude-3-5-haiku-20241022': { name: 'Claude 3.5 Haiku', provider: 'anthropic', contextWindow: 200000 },
  'gemini-2.0-flash': { name: 'Gemini 2.0 Flash', provider: 'google', contextWindow: 1000000 },
};

// ============================================
// API Request/Response types
// ============================================
export interface ChatRequest {
  tenantId: string;
  agentId: string;
  chatId?: string;
  messages: Array<{
    id?: string;
    role: 'user' | 'assistant' | 'system';
    content?: string;
    parts?: MessagePart[];
  }>;
}


export interface CreateAgentRequest {
  name: string;
  description?: string;
  config: Partial<AgentConfig>;
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  config?: Partial<AgentConfig>;
  status?: Agent['status'];
}