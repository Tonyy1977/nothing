import { generateId } from 'ai';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const chatId = generateId();

  // default demo agent for now
  redirect(`/chat/${chatId}?tenantId=tenant_demo&agentId=agent_support`);
}
