import { generateId } from 'ai';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  // Generate a new chat ID and redirect to chat page
  const chatId = generateId();
  redirect(`/chat/${chatId}`);
}