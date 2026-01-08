// route.ts - Updated for new @ai-sdk/react API
import { generateId, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
// Uncomment when you add API keys:
// import { anthropic } from '@ai-sdk/anthropic';
// import { google } from '@ai-sdk/google-vertex';

// In-memory chat storage (replace with DB later)
const chats = new Map<string, any>();

function readChat(id: string) {
  return chats.get(id) || { id, messages: [] };
}

function saveChat(chat: any) {
  chats.set(chat.id, chat);
}

// Multi-vendor model selector
function getModel(provider: string = 'openai', modelName?: string) {
  switch (provider.toLowerCase()) {
    case 'openai':
      return openai(modelName || 'gpt-4o-mini');
    
    // Uncomment when you have API keys:
    // case 'anthropic':
    //   return anthropic(modelName || 'claude-3-sonnet-20240229');
    // case 'google':
    //   return google(modelName || 'gemini-pro');
    
    default:
      console.warn(`Unknown provider: ${provider}, defaulting to OpenAI`);
      return openai('gpt-4o-mini');
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  console.log('📥 Received body:', JSON.stringify(body, null, 2));

  // New useChat API sends: { id, messages: [...] }
  // OR individual message: { id, message: {...} }
  const {
    id,
    messages: incomingMessages,
    message: singleMessage,
    provider,
    model,
  } = body;

  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Missing chat id' }),
      { status: 400 }
    );
  }

  // Get existing chat
  const chat = readChat(id);
  
  // Determine messages to use
  let messages = [];
  
  if (incomingMessages && Array.isArray(incomingMessages)) {
    // New API sends full message array
    messages = incomingMessages;
  } else if (singleMessage) {
    // Old format compatibility
    messages = [...(chat.messages || []), singleMessage];
  } else {
    // Use existing chat messages
    messages = chat.messages || [];
  }

  console.log('💬 Processing messages:', messages.length);
  console.log('📝 Messages array:', JSON.stringify(messages, null, 2));

  // Validate messages
  if (!messages || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No messages to process' }),
      { status: 400 }
    );
  }

  // Save updated chat
  saveChat({ id, messages });

  // Stream AI response
  try {
    const selectedModel = getModel(provider, model);
    
    console.log('🤖 Sending to AI with messages:', messages);
    
    const result = streamText({
      model: selectedModel,
      messages: messages,  // Pass directly - SDK handles conversion
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: generateId,
      onFinish: async ({ messages: finalMessages }) => {
        console.log('✅ Finished, saving messages');
        saveChat({ id, messages: finalMessages });
      },
    });
  } catch (error: any) {
    console.error('❌ AI API Error:', error);
    console.error('Stack:', error.stack);
    
    if (error.message?.includes('API key')) {
      return new Response(
        JSON.stringify({ 
          error: 'API key not configured. Please add OPENAI_API_KEY to .env.local' 
        }),
        { status: 500 }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to generate response',
        stack: error.stack 
      }),
      { status: 500 }
    );
  }
}