'use client';

import { useChat } from '@ai-sdk/react';

export default function Chat({ chatId }: { chatId: string }) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
  } = useChat({
    api: '/api/chat',
    body: {
      id: chatId,
      trigger: 'submit-message',
    },
  });

  return (
    <div style={{ padding: 20 }}>
      <div>
        {messages.map(m => (
          <div key={m.id}>
            <b>{m.role}:</b> {m.content}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();   // 🔑 THIS stops the reload
          handleSubmit(e);      // let the SDK handle the rest
        }}
      >
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Say something"
        />
      </form>
    </div>
  );
}
