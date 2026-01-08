// app/api/analytics/route.ts - Basic analytics for Phase 2
import { TenantStore, AgentStore, ChatStore, MessageStore } from '@/db/store';

// GET /api/analytics?tenantId=xxx
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get('tenantId');
  const agentId = searchParams.get('agentId'); // Optional filter

  if (!tenantId) {
    return Response.json({ error: 'tenantId required' }, { status: 400 });
  }

  // Verify tenant exists
  const tenant = TenantStore.getById(tenantId);
  if (!tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // Get all agents for tenant
  const agents = AgentStore.getByTenant(tenantId);
  
  // Get all chats for tenant (or specific agent)
  let chats = ChatStore.getByTenant(tenantId);
  if (agentId) {
    chats = chats.filter(c => c.agentId === agentId);
  }

  // Calculate stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const chatsThisMonth = chats.filter(c => c.createdAt >= startOfMonth).length;
  const chatsThisWeek = chats.filter(c => c.createdAt >= startOfWeek).length;
  const chatsToday = chats.filter(c => c.createdAt >= startOfDay).length;

  // Message counts
  let totalMessages = 0;
  let userMessages = 0;
  let assistantMessages = 0;
  
  for (const chat of chats) {
    const msgs = MessageStore.getByChatId(chat.id);
    totalMessages += msgs.length;
    userMessages += msgs.filter(m => m.role === 'user').length;
    assistantMessages += msgs.filter(m => m.role === 'assistant').length;
  }

  // Per-agent breakdown
  const agentStats = agents.map(agent => {
    const agentChats = chats.filter(c => c.agentId === agent.id);
    let agentMessages = 0;
    for (const chat of agentChats) {
      agentMessages += MessageStore.getByChatId(chat.id).length;
    }
    return {
      agentId: agent.id,
      name: agent.name,
      status: agent.status,
      model: agent.config.model,
      totalChats: agentChats.length,
      totalMessages: agentMessages,
    };
  });

  return Response.json({
    tenant: {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
    },
    summary: {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.status === 'active').length,
      totalChats: chats.length,
      totalMessages,
      userMessages,
      assistantMessages,
    },
    period: {
      chatsToday,
      chatsThisWeek,
      chatsThisMonth,
      quotaUsed: chatsThisMonth,
      quotaLimit: tenant.settings.maxChatsPerMonth,
      quotaPercentage: Math.round((chatsThisMonth / tenant.settings.maxChatsPerMonth) * 100),
    },
    agents: agentStats,
  });
}