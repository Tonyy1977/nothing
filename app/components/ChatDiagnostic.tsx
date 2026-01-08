'use client';

import { useChat } from '@ai-sdk/react';

export default function ChatDiagnostic() {
  const result = useChat({
    api: '/api/chat',
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">useChat Diagnostic</h1>
      
      <div className="bg-gray-100 p-4 rounded mb-4">
        <h2 className="font-bold mb-2">What useChat returned:</h2>
        <pre className="text-xs overflow-auto">
          {JSON.stringify({
            hasMessages: !!result.messages,
            messagesLength: result.messages?.length,
            hasInput: result.input !== undefined,
            inputValue: result.input,
            hasHandleInputChange: !!result.handleInputChange,
            hasHandleSubmit: !!result.handleSubmit,
            isLoading: result.isLoading,
            error: result.error?.message,
            allKeys: Object.keys(result || {}),
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
