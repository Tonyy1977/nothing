// lib/knowledge/processor.ts
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

const CHUNK_SIZE = 1000;     // Characters per chunk
const CHUNK_OVERLAP = 200;   // Overlap for context continuity

export async function processDocument(
  file: File,
  knowledgeSourceId: string,
  tenantId: string
): Promise<DocumentChunk[]> {
  // 1. Extract text
  const text = await extractText(file);
  
  // 2. Chunk the text
  const textChunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);
  
  // 3. Generate embeddings (batch)
  const chunks: DocumentChunk[] = [];
  
  for (let i = 0; i < textChunks.length; i++) {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: textChunks[i],
    });
    
    chunks.push({
      id: `chunk_${crypto.randomUUID().slice(0, 12)}`,
      knowledgeSourceId,
      tenantId,
      content: textChunks[i],
      embedding,
      metadata: { chunkIndex: i },
      createdAt: new Date(),
    });
  }
  
  return chunks;
}

function chunkText(text: string, size: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start + overlap >= text.length) break;
  }
  
  return chunks;
}

async function extractText(file: File): Promise<string> {
  const type = file.type;
  
  if (type === 'application/pdf') {
    // Use pdf-parse or pdfjs-dist
    const pdfParse = await import('pdf-parse');
    const buffer = await file.arrayBuffer();
    const data = await pdfParse(Buffer.from(buffer));
    return data.text;
  }
  
  if (type === 'text/plain' || type === 'text/markdown') {
    return await file.text();
  }
  
  throw new Error(`Unsupported file type: ${type}`);
}