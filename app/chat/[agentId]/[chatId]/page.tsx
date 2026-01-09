import { notFound } from 'next/navigation';
import Chat from '@/app/components/chat/Chat';
import { AgentStore } from '@/db/store';

export default async function ChatPage({
  params,
}: {
  params: Promise<{ agentId: string; chatId: string }>;
}) {
  const { agentId, chatId } = await params;

  const agent = AgentStore.getById(agentId);
  if (!agent || agent.status !== 'active') notFound();

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <Chat tenantId={agent.tenantId} agent={agent} chatId={chatId} />
    </main>
  );
}
