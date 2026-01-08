'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef, useState } from 'react';

export default function Chat({ chatId }: { chatId: string }) {
  const [input, setInput] = useState('');
  
  const {
    messages,
    sendMessage,
    status,
    error,
  } = useChat({
    api: '/api/chat',
    id: chatId,
    // Let the SDK handle the message format
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status === 'in_progress') return;

    // Send the message - SDK handles the rest
    await sendMessage({
      role: 'user',
      content: input,
    });

    // Clear input
    setInput('');
  };

  const isLoading = status === 'in_progress';

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto p-4">
      {/* Header */}
      <div className="mb-4 pb-4 border-b">
        <h1 className="text-2xl font-bold">AI Chat</h1>
        <p className="text-sm text-gray-500">Chat ID: {chatId}</p>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <p>No messages yet. Start a conversation!</p>
          </div>
        )}
        
        {messages.map(m => (
          <div
            key={m.id}
            className={`p-4 rounded-lg ${
              m.role === 'user'
                ? 'bg-blue-100 ml-auto max-w-[80%]'
                : 'bg-gray-100 mr-auto max-w-[80%]'
            }`}
          >
            <div className="font-semibold text-sm mb-1 capitalize">
              {m.role === 'user' ? 'You' : 'AI Assistant'}
            </div>
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
        
        {isLoading && (
          <div className="bg-gray-100 p-4 rounded-lg mr-auto max-w-[80%]">
            <div className="font-semibold text-sm mb-1">AI Assistant</div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <strong>Error:</strong> {error.message}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
          className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}