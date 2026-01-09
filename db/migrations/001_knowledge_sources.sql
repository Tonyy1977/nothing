-- Migration: 001_knowledge_sources.sql
-- Phase 3: Knowledge Sources with pgvector for RAG
-- Run: psql -d your_database -f 001_knowledge_sources.sql

-- ============================================
-- Enable pgvector extension
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Knowledge Sources table
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id VARCHAR(50) PRIMARY KEY,
  tenant_id VARCHAR(50) NOT NULL,
  agent_id VARCHAR(50),                -- NULL = tenant-wide
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL CHECK (type IN ('pdf', 'txt', 'md', 'docx', 'url')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for knowledge_sources
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_tenant ON knowledge_sources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_agent ON knowledge_sources(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_status ON knowledge_sources(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_tenant_status ON knowledge_sources(tenant_id, status);

-- ============================================
-- Document Chunks table with vector embedding
-- ============================================
CREATE TABLE IF NOT EXISTS document_chunks (
  id VARCHAR(50) PRIMARY KEY,
  knowledge_source_id VARCHAR(50) NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  tenant_id VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),              -- OpenAI text-embedding-3-small dimensions
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for document_chunks
CREATE INDEX IF NOT EXISTS idx_chunks_knowledge_source ON document_chunks(knowledge_source_id);
CREATE INDEX IF NOT EXISTS idx_chunks_tenant ON document_chunks(tenant_id);

-- HNSW index for fast approximate nearest neighbor search
-- Better for production: faster queries, higher memory usage
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw ON document_chunks 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Alternative: IVFFlat index (faster to build, slightly slower queries)
-- Uncomment if you prefer this:
-- CREATE INDEX IF NOT EXISTS idx_chunks_embedding_ivfflat ON document_chunks 
--   USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- ============================================
-- Helper function: similarity search
-- ============================================
CREATE OR REPLACE FUNCTION search_similar_chunks(
  query_embedding vector(1536),
  p_tenant_id VARCHAR(50),
  p_knowledge_source_ids VARCHAR(50)[] DEFAULT NULL,
  p_top_k INTEGER DEFAULT 5,
  p_min_score FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  chunk_id VARCHAR(50),
  knowledge_source_id VARCHAR(50),
  content TEXT,
  metadata JSONB,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id AS chunk_id,
    dc.knowledge_source_id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  JOIN knowledge_sources ks ON dc.knowledge_source_id = ks.id
  WHERE 
    dc.tenant_id = p_tenant_id
    AND ks.status = 'ready'
    AND (p_knowledge_source_ids IS NULL OR dc.knowledge_source_id = ANY(p_knowledge_source_ids))
    AND 1 - (dc.embedding <=> query_embedding) >= p_min_score
  ORDER BY dc.embedding <=> query_embedding
  LIMIT p_top_k;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_knowledge_sources_updated_at
  BEFORE UPDATE ON knowledge_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Useful views
-- ============================================
CREATE OR REPLACE VIEW knowledge_source_stats AS
SELECT 
  ks.id,
  ks.tenant_id,
  ks.agent_id,
  ks.name,
  ks.type,
  ks.status,
  COUNT(dc.id) AS chunk_count,
  SUM(LENGTH(dc.content)) AS total_chars,
  ks.created_at,
  ks.updated_at
FROM knowledge_sources ks
LEFT JOIN document_chunks dc ON ks.id = dc.knowledge_source_id
GROUP BY ks.id;

-- ============================================
-- Sample queries for testing
-- ============================================
-- Insert test knowledge source:
-- INSERT INTO knowledge_sources (id, tenant_id, name, type, status) 
-- VALUES ('ks_test123', 'tenant_demo', 'Test Document', 'pdf', 'ready');

-- Search similar chunks:
-- SELECT * FROM search_similar_chunks(
--   '[0.1, 0.2, ...]'::vector(1536),  -- your query embedding
--   'tenant_demo',
--   ARRAY['ks_test123'],
--   5,
--   0.7
-- );