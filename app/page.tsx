import { generateId } from 'ai';
import { redirect } from 'next/navigation';
import { ensureDemoSeeded, AgentStore } from '@/db/store';

export default async function HomePage() {
  ensureDemoSeeded();

  const tenantId = 'tenant_demo';
  const agent = AgentStore.getByTenant(tenantId).find(a => a.status === 'active');

  const agentId = agent?.id ?? 'agent_support';
  const chatId = generateId();

  redirect(`/chat/${agentId}/${chatId}`);
}
