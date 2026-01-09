// lib/knowledge/index.ts - Public API for knowledge module

// Parsing
export { parseDocument, parseURL, detectMimeType, validateFile, isSupported, MAX_FILE_SIZE } from './parser';
export type { ParsedDocument, SupportedMimeType } from './parser';

// Chunking
export { chunkByCharacters, chunkByParagraphs, chunkBySections, chunkWithPages, estimateTokens } from './chunker';
export type { TextChunk, ChunkOptions } from './chunker';

// Embeddings
export { generateEmbedding, generateEmbeddings, generateQueryEmbedding, cosineSimilarity } from './embeddings';

// Processing
export { processDocument, processURL, reprocessKnowledgeSource, getKnowledgeSourceType } from './processor';
export type { ProcessingOptions, ProcessingResult } from './processor';

// Retrieval
export { retrieveContext, formatContextForPrompt, augmentSystemPrompt, extractRagMetadata, isRagEnabled, extractUserQuery } from './retriever';