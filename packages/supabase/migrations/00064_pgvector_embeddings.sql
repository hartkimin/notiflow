-- pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns to tables
ALTER TABLE my_drugs
  ADD COLUMN IF NOT EXISTS embedding vector(768),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

ALTER TABLE my_devices
  ADD COLUMN IF NOT EXISTS embedding vector(768),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

ALTER TABLE hospitals
  ADD COLUMN IF NOT EXISTS embedding vector(768),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

ALTER TABLE captured_messages
  ADD COLUMN IF NOT EXISTS embedding vector(768),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

-- Vector search RPC functions
CREATE OR REPLACE FUNCTION match_products(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 5
)
RETURNS TABLE (id int, name text, type text, similarity float)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT id, item_name AS name, 'drug' AS type,
    1 - (embedding <=> query_embedding) AS similarity
  FROM my_drugs
  WHERE embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  UNION ALL
  SELECT id, prdlst_nm AS name, 'device' AS type,
    1 - (embedding <=> query_embedding) AS similarity
  FROM my_devices
  WHERE embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_messages(
  query_embedding vector(768),
  sender_filter text DEFAULT NULL,
  match_count int DEFAULT 3
)
RETURNS TABLE (id text, content text, sender text, similarity float)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT id, content, sender,
    1 - (embedding <=> query_embedding) AS similarity
  FROM captured_messages
  WHERE embedding IS NOT NULL
    AND is_deleted = false
    AND (sender_filter IS NULL OR sender = sender_filter)
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_hospitals(
  query_embedding vector(768),
  match_count int DEFAULT 3
)
RETURNS TABLE (id int, name text, similarity float)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT id, name,
    1 - (embedding <=> query_embedding) AS similarity
  FROM hospitals
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
