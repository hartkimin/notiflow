-- ============================================================
-- RPC: Bulk-increment match_count + last_matched_at on product_aliases
-- Called by matchProductsBulk after product matching.
-- ============================================================

CREATE OR REPLACE FUNCTION increment_alias_match_counts(alias_ids int[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE product_aliases
  SET match_count   = COALESCE(match_count, 0) + 1,
      last_matched_at = now()
  WHERE id = ANY(alias_ids);
END;
$$;
