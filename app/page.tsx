//page.tsx
import { generateId } from 'ai';
import Chat from './components/chat/Chat';

export default async function ChatPage() {
  return <Chat chatData={{ id: generateId(), messages: [] }} isNewChat />;
}
