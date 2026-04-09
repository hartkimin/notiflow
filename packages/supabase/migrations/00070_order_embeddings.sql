-- 00070_order_embeddings.sql
-- Table to store order embeddings for RAG
CREATE TABLE IF NOT EXISTS public.order_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id bigint REFERENCES public.orders(id) ON DELETE CASCADE UNIQUE,
  content text NOT NULL,
  embedding vector(768),
  embedding_model text,
  embedded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Table for drug/product embeddings
CREATE TABLE IF NOT EXISTS public.product_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id int NOT NULL,
  product_type text NOT NULL CHECK (product_type IN ('drug', 'device')),
  content text NOT NULL,
  embedding vector(768),
  embedding_model text,
  embedded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, product_type)
);

-- Table for hospital/supplier embeddings
CREATE TABLE IF NOT EXISTS public.partner_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id int NOT NULL,
  partner_type text NOT NULL CHECK (partner_type IN ('hospital', 'supplier')),
  content text NOT NULL,
  embedding vector(768),
  embedding_model text,
  embedded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, partner_type)
);

-- Indices for vector search
CREATE INDEX IF NOT EXISTS order_embeddings_vector_idx ON public.order_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS product_embeddings_vector_idx ON public.product_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS partner_embeddings_vector_idx ON public.partner_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RPC for matching products
CREATE OR REPLACE FUNCTION public.match_products_rag(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  product_id int,
  product_type text,
  content text,
  similarity float
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT product_id, product_type, content, 1 - (embedding <=> query_embedding) AS similarity
  FROM product_embeddings
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC LIMIT match_count;
$$;

-- RPC for matching partners (hospitals/suppliers)
CREATE OR REPLACE FUNCTION public.match_partners_rag(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  partner_id int,
  partner_type text,
  content text,
  similarity float
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT partner_id, partner_type, content, 1 - (embedding <=> query_embedding) AS similarity
  FROM partner_embeddings
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC LIMIT match_count;
$$;

-- RPC for matching orders
CREATE OR REPLACE FUNCTION public.match_orders(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  order_id bigint,
  content text,
  similarity float
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT
    order_id,
    content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM order_embeddings
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Webhook function for Orders
CREATE OR REPLACE FUNCTION public.notify_embed_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
BEGIN
  edge_function_url := COALESCE(current_setting('app.settings.supabase_url', true), 'http://kong:8000') || '/functions/v1/embed-order';
  service_role_key := current_setting('app.settings.service_role_key', true);

  IF edge_function_url IS NULL OR service_role_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key),
    body := jsonb_build_object('type', TG_OP, 'table', 'orders', 'record', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$;

-- Webhook function for Entities (Drugs, Devices, Partners)
CREATE OR REPLACE FUNCTION public.notify_embed_entity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
  entity_type text;
BEGIN
  edge_function_url := COALESCE(current_setting('app.settings.supabase_url', true), 'http://kong:8000') || '/functions/v1/embed-entity';
  service_role_key := current_setting('app.settings.service_role_key', true);
  entity_type := TG_ARGV[0];

  IF edge_function_url IS NULL OR service_role_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key),
    body := jsonb_build_object('type', TG_OP, 'table', TG_TABLE_NAME, 'entity_type', entity_type, 'record', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$;

-- Triggers
DROP TRIGGER IF EXISTS on_order_sync_embed ON orders;
CREATE TRIGGER on_order_sync_embed
  AFTER INSERT OR UPDATE OF order_number, order_date, status, hospital_id, notes ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_embed_order();

DROP TRIGGER IF EXISTS on_drug_sync_embed ON my_drugs;
CREATE TRIGGER on_drug_sync_embed AFTER INSERT OR UPDATE OF item_name, entp_name, bar_code ON my_drugs FOR EACH ROW EXECUTE FUNCTION public.notify_embed_entity('drug');

DROP TRIGGER IF EXISTS on_device_sync_embed ON my_devices;
CREATE TRIGGER on_device_sync_embed AFTER INSERT OR UPDATE OF prdlst_nm, mnft_iprt_entp_nm, udidi_cd ON my_devices FOR EACH ROW EXECUTE FUNCTION public.notify_embed_entity('device');

DROP TRIGGER IF EXISTS on_hospital_sync_embed ON hospitals;
CREATE TRIGGER on_hospital_sync_embed AFTER INSERT OR UPDATE OF name, address, contact_person, business_number ON hospitals FOR EACH ROW EXECUTE FUNCTION public.notify_embed_entity('hospital');

DROP TRIGGER IF EXISTS on_supplier_sync_embed ON suppliers;
CREATE TRIGGER on_supplier_sync_embed AFTER INSERT OR UPDATE OF name, short_name, contact_info ON suppliers FOR EACH ROW EXECUTE FUNCTION public.notify_embed_entity('supplier');
