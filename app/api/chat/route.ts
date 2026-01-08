// app/api/chat/route.ts - AI SDK 6 Compatible
import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { openai } from '@ai-sdk/openai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // AI SDK 6: Extract messages from request body
    const body = await req.json();
    const { messages } = body;

    console.log('📥 Chat request received:', JSON.stringify(body, null, 2));

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No messages provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if messages are in UIMessage format (have parts) or need conversion
    const uiMessages: UIMessage[] = messages.map((msg: Record<string, unknown>) => {
      // If message already has parts array, it's UIMessage format
      if (msg.parts && Array.isArray(msg.parts)) {
        return msg as UIMessage;
      }
      
      // Convert legacy format (content string) to UIMessage format
      return {
        id: msg.id || crypto.randomUUID(),
        role: msg.role as 'user' | 'assistant' | 'system',
        parts: [{ type: 'text', text: String(msg.content || '') }],
      } as UIMessage;
    });

    console.log('📝 Converted messages:', JSON.stringify(uiMessages, null, 2));

    // AI SDK 6: Use streamText with convertToModelMessages
    const result = streamText({
      model: openai('gpt-4o-mini'),
      system: 'You are a helpful AI assistant.',
      messages: await convertToModelMessages(uiMessages),
    });

    // AI SDK 6: Return UI message stream response
    return result.toUIMessageStreamResponse();
    
  } catch (error: unknown) {
    console.error('❌ Chat API Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    console.error('Stack:', errorStack);
    
    if (errorMessage.includes('API key') || errorMessage.includes('apiKey')) {
      return new Response(
        JSON.stringify({ 
          error: 'API key not configured. Please add OPENAI_API_KEY to .env.local' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        error: 'Failed to process chat request',
        details: errorMessage 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}