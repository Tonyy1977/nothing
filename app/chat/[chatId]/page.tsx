import Chat from '@/app/components/chat/Chat';

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  return <Chat chatId={chatId} />;
}