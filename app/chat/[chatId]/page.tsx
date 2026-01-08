import Chat from '@/app/components/chat/Chat';
import { AgentStore, ensureDemoSeeded } from '@/db/store';
import { notFound } from 'next/navigation';

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ chatId: string }>;
  searchParams: Promise<{ tenantId?: string; agentId?: string }>;
}) {
  const { chatId } = await params;
  const { tenantId, agentId } = await searchParams;

  ensureDemoSeeded();

  // Temporary defaults for Phase 2 dev
  const resolvedTenantId = tenantId ?? 'tenant_demo';

  // Prefer agentId from URL, otherwise pick first active agent
  const resolvedAgentId =
    agentId ??
    AgentStore.getByTenant(resolvedTenantId).find(a => a.status === 'active')?.id;

  if (!resolvedAgentId) notFound();

  const agent = AgentStore.getById(resolvedAgentId);
  if (!agent) notFound();

  return <Chat tenantId={resolvedTenantId} agent={agent} chatId={chatId} />;
}
