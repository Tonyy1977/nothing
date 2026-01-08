'use client';

import { useChat } from '@ai-sdk/react';
import { useRef, useEffect, useState } from 'react';
import type { Agent } from '@/types';
import { generateId } from 'ai';

interface ChatProps {
  tenantId: string;
  agent: Agent;
  chatId?: string;
}

export default function Chat({ tenantId, agent, chatId: initialChatId }: ChatProps) {
  const [input, setInput] = useState('');
  const [chatId] = useState(() => initialChatId ?? generateId());

  const {
    messages,
    sendMessage,
    status,
    error,
    stop,
    regenerate,
  } = useChat({
    id: chatId,
    // Custom API with tenant/agent context
    api: '/api/chat',
    // Add tenant/agent to every request
    body: {
      tenantId,
      agentId: agent.id,
      chatId,
    },
    onFinish: (message) => {
      console.log('✅ Message complete:', message.id);
    },
    onError: (err) => {
      console.error('❌ Chat error:', err);
    },
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show welcome message if no messages
  const showWelcome = messages.length === 0 && agent.config.welcomeMessage;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status !== 'ready') return;
    sendMessage({ role: 'user', content: input });
    setInput('');
  };

  const isLoading = status === 'streaming' || status === 'submitted';

  // Theme from agent config
  const primaryColor = agent.config.theme?.primaryColor || '#3B82F6';

  return (
    <div className="flex flex-col h-full">
      {/* Agent Header */}
      <div 
        className="p-4 border-b"
        style={{ borderBottomColor: primaryColor }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: primaryColor }}
          >
            {agent.name.charAt(0)}
          </div>
          <div>
            <h2 className="font-semibold">{agent.name}</h2>
            <p className="text-sm text-gray-500">{agent.description}</p>
          </div>
          <div className="ml-auto">
            <span className={`text-xs px-2 py-1 rounded ${
              agent.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {agent.status}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Welcome message */}
        {showWelcome && (
          <div className="bg-gray-100 p-4 rounded-lg max-w-[80%]">
            <p>{agent.config.welcomeMessage}</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-4 rounded-lg ${
              message.role === 'user'
                ? 'ml-auto max-w-[80%]'
                : 'mr-auto max-w-[80%] bg-gray-100'
            }`}
            style={message.role === 'user' ? { backgroundColor: `${primaryColor}20` } : {}}
          >
            <div className="text-xs text-gray-500 mb-1">
              {message.role === 'user' ? 'You' : agent.name}
            </div>
            <div className="whitespace-pre-wrap">
              <div className="whitespace-pre-wrap">
  {message.parts?.map((part, i) => {
    if (part.type === 'text') return <span key={i}>{part.text}</span>;
    return null;
  }) ?? message.content}
</div>

            </div>
          </div>
        ))}

        {isLoading && (
          <div className="bg-gray-100 p-4 rounded-lg max-w-[80%]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: primaryColor }} />
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: primaryColor, animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: primaryColor, animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-700 p-3 rounded-lg">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error.message}</p>
            <button onClick={() => regenerate()} className="text-sm underline mt-2">
              Try again
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={stop}
              className="px-4 py-2 rounded-full bg-red-500 text-white"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-4 py-2 rounded-full text-white disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              Send
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          Powered by {agent.config.model}
        </p>
      </form>
    </div>
  );
}