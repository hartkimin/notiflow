-- Safe read-only SQL execution for AI text-to-SQL feature
-- Only SELECT/WITH queries allowed, all mutations blocked

CREATE OR REPLACE FUNCTION exec_readonly_sql(query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  upper_query TEXT;
BEGIN
  upper_query := UPPER(TRIM(query));

  IF NOT (upper_query LIKE 'SELECT%' OR upper_query LIKE 'WITH%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  IF upper_query ~ '(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXECUTE)' THEN
    RAISE EXCEPTION 'Mutation queries are not allowed';
  END IF;

  SET LOCAL transaction_read_only = ON;
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query || ') t' INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
