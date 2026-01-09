'use client';

import * as React from 'react';
import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';
import { MODEL_INFO, type Agent } from '@/types';

export default function Chat({
  tenantId,
  agent,
  chatId,
}: {
  tenantId: string;
  agent: Agent | undefined;
  chatId: string;
}) {
  const [input, setInput] = React.useState('');

  // Safety guard (prevents your “agent is undefined” crash)
  if (!agent) {
    return <div style={{ padding: 12 }}>Agent not found.</div>;
  }

  const { messages, sendMessage, status, stop, regenerate, error } = useChat({

    id: chatId,
        transport: new DefaultChatTransport({
      api: '/api/chat',
      body: {
        tenantId,
        agentId: agent.id,
        chatId,
      },
    }),
  });

  const modelInfo = MODEL_INFO[agent.config.model];
  const modelLabel = modelInfo
    ? `${modelInfo.provider}/${agent.config.model}`
    : agent.config.model;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <b>{agent.name}</b>
                <span style={{ opacity: 0.6 }}>({modelLabel})</span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => regenerate()} disabled={status === 'streaming'}>
            Regenerate
          </button>
          <button type="button" onClick={() => stop()} disabled={status !== 'streaming'}>
            Stop
          </button>
        </div>
      </div>

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: 10,
          padding: 12,
          minHeight: 360,
          whiteSpace: 'pre-wrap',
        }}
      >
        {messages.map(m => (
          <div key={m.id} style={{ marginBottom: 10 }}>
            <b>{m.role}:</b>{' '}
            {m.parts?.map((p, i) => (p.type === 'text' ? <span key={i}>{p.text}</span> : null))}
          </div>
        ))}

        {error ? (
          <div style={{ marginTop: 12, color: 'crimson' }}>
            <b>Error:</b> {error.message}
          </div>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const text = input.trim();
          if (!text) return;

          setInput('');
          sendMessage({ text });
        }}
        style={{ display: 'flex', gap: 8 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Say something..."
          style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #ddd' }}
        />
        <button type="submit" disabled={status === 'streaming'}>
          Send
        </button>
      </form>
    </div>
  );
}
