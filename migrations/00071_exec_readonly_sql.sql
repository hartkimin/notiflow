-- Safe read-only SQL execution for AI text-to-SQL feature
-- Comprehensive security: blocks mutations, system catalogs, dangerous functions

CREATE OR REPLACE FUNCTION exec_readonly_sql(query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  upper_query TEXT;
  clean_query TEXT;
BEGIN
  -- Remove comments
  clean_query := regexp_replace(query, '--[^\n]*', '', 'g');
  clean_query := regexp_replace(clean_query, '/\*.*?\*/', '', 'g');
  upper_query := UPPER(TRIM(clean_query));

  -- Must start with SELECT or WITH
  IF NOT (upper_query LIKE 'SELECT%' OR upper_query LIKE 'WITH%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  -- Block all mutation keywords
  IF upper_query ~ '\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXECUTE|COPY|LOAD|IMPORT)\b' THEN
    RAISE EXCEPTION 'Mutation queries are not allowed';
  END IF;

  -- Block system catalog access
  IF upper_query ~ '\b(PG_CATALOG|INFORMATION_SCHEMA|PG_PROC|PG_SHADOW|PG_ROLES|PG_AUTHID|PG_USER)\b' THEN
    RAISE EXCEPTION 'System catalog access is not allowed';
  END IF;

  -- Block dangerous functions
  IF upper_query ~ '\b(PG_READ_FILE|PG_WRITE_FILE|PG_SLEEP|DBLINK|LO_IMPORT|LO_EXPORT|PG_TERMINATE_BACKEND|PG_CANCEL_BACKEND|SET\s+ROLE|SET\s+SESSION)\b' THEN
    RAISE EXCEPTION 'Blocked function or command';
  END IF;

  -- Block semicolons (prevent multi-statement injection)
  IF clean_query ~ ';.*\S' THEN
    RAISE EXCEPTION 'Multiple statements not allowed';
  END IF;

  -- Block access to internal Supabase schemas
  IF upper_query ~ '\b(AUTH\.|STORAGE\.|EXTENSIONS\.|NET\.|VAULT\.|SUPABASE_)\b' THEN
    RAISE EXCEPTION 'Access to internal schemas is not allowed';
  END IF;

  -- Force read-only transaction
  SET LOCAL transaction_read_only = ON;

  -- Auto-add LIMIT if missing to prevent excessive data
  IF upper_query NOT LIKE '%LIMIT%' THEN
    clean_query := clean_query || ' LIMIT 100';
  END IF;

  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || clean_query || ') t' INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
EXCEPTION
  WHEN read_only_sql_transaction THEN
    RAISE EXCEPTION 'Write operation blocked by read-only mode';
END;
$$;
