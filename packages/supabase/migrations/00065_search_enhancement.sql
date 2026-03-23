-- ═══════════════════════════════════════════════════════════════════════
-- 00065_search_enhancement.sql
-- GIN trigram indexes + RPC search functions for my_drugs, my_devices,
-- mfds_drugs, mfds_devices, hospitals, suppliers
-- pg_trgm lives in extensions schema (moved in 00063)
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. GIN trigram indexes: my_drugs ──────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_my_drugs_item_name_trgm
  ON my_drugs USING gin (item_name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_my_drugs_entp_name_trgm
  ON my_drugs USING gin (entp_name extensions.gin_trgm_ops)
  WHERE entp_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_my_drugs_bar_code
  ON my_drugs (bar_code)
  WHERE bar_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_my_drugs_edi_code
  ON my_drugs (edi_code)
  WHERE edi_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_my_drugs_material_name_trgm
  ON my_drugs USING gin (material_name extensions.gin_trgm_ops)
  WHERE material_name IS NOT NULL;

-- ─── 2. GIN trigram indexes: my_devices ────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_my_devices_prdlst_nm_trgm
  ON my_devices USING gin (prdlst_nm extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_my_devices_mnft_iprt_entp_nm_trgm
  ON my_devices USING gin (mnft_iprt_entp_nm extensions.gin_trgm_ops)
  WHERE mnft_iprt_entp_nm IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_my_devices_udidi_cd
  ON my_devices (udidi_cd)
  WHERE udidi_cd IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_my_devices_foml_info_trgm
  ON my_devices USING gin (foml_info extensions.gin_trgm_ops)
  WHERE foml_info IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_my_devices_prdt_nm_info_trgm
  ON my_devices USING gin (prdt_nm_info extensions.gin_trgm_ops)
  WHERE prdt_nm_info IS NOT NULL;

-- ─── 3. GIN trigram indexes: hospitals ─────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_hospitals_name_trgm
  ON hospitals USING gin (name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_hospitals_short_name_trgm
  ON hospitals USING gin (short_name extensions.gin_trgm_ops)
  WHERE short_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hospitals_address_trgm
  ON hospitals USING gin (address extensions.gin_trgm_ops)
  WHERE address IS NOT NULL;

-- ─── 4. GIN trigram indexes: suppliers ─────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_suppliers_name_trgm
  ON suppliers USING gin (name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_suppliers_short_name_trgm
  ON suppliers USING gin (short_name extensions.gin_trgm_ops)
  WHERE short_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_business_category_trgm
  ON suppliers USING gin (business_category extensions.gin_trgm_ops)
  WHERE business_category IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════
-- 5. RPC: search_my_items
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION search_my_items(
  query TEXT,
  source_type TEXT DEFAULT 'all',
  result_limit INT DEFAULT 30
)
RETURNS TABLE (
  id          INT,
  item_type   TEXT,
  name        TEXT,
  code        TEXT,
  manufacturer TEXT,
  unit_price  NUMERIC,
  rank        REAL,
  raw_data    JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  q TEXT := TRIM(query);
  like_q TEXT;
BEGIN
  -- Empty query returns nothing
  IF q IS NULL OR q = '' THEN
    RETURN;
  END IF;

  like_q := '%' || q || '%';

  RETURN QUERY

  -- === Drug results ===
  SELECT
    d.id,
    'drug'::TEXT AS item_type,
    d.item_name::TEXT AS name,
    COALESCE(d.bar_code, d.edi_code)::TEXT AS code,
    d.entp_name::TEXT AS manufacturer,
    d.unit_price::NUMERIC AS unit_price,
    (
      CASE WHEN (
        d.item_name ILIKE like_q
        OR d.entp_name ILIKE like_q
        OR d.bar_code ILIKE like_q
        OR d.edi_code ILIKE like_q
        OR d.material_name ILIKE like_q
        OR d.pack_unit ILIKE like_q
      ) THEN 1 ELSE 0 END
      + GREATEST(
          extensions.similarity(COALESCE(d.item_name, ''), q),
          extensions.similarity(COALESCE(d.entp_name, ''), q)
        )
    )::REAL AS rank,
    to_jsonb(d) AS raw_data
  FROM my_drugs d
  WHERE source_type IN ('all', 'drug')
    AND (
      d.item_name ILIKE like_q
      OR d.entp_name ILIKE like_q
      OR d.bar_code ILIKE like_q
      OR d.edi_code ILIKE like_q
      OR d.material_name ILIKE like_q
      OR d.pack_unit ILIKE like_q
      OR extensions.similarity(COALESCE(d.item_name, ''), q) > 0.15
      OR extensions.similarity(COALESCE(d.entp_name, ''), q) > 0.15
    )

  UNION ALL

  -- === Device results ===
  SELECT
    d.id,
    'device'::TEXT AS item_type,
    d.prdlst_nm::TEXT AS name,
    d.udidi_cd::TEXT AS code,
    d.mnft_iprt_entp_nm::TEXT AS manufacturer,
    d.unit_price::NUMERIC AS unit_price,
    (
      CASE WHEN (
        d.prdlst_nm ILIKE like_q
        OR d.mnft_iprt_entp_nm ILIKE like_q
        OR d.udidi_cd ILIKE like_q
        OR d.foml_info ILIKE like_q
        OR d.prdt_nm_info ILIKE like_q
        OR d.permit_no ILIKE like_q
      ) THEN 1 ELSE 0 END
      + GREATEST(
          extensions.similarity(COALESCE(d.prdlst_nm, ''), q),
          extensions.similarity(COALESCE(d.mnft_iprt_entp_nm, ''), q)
        )
    )::REAL AS rank,
    to_jsonb(d) AS raw_data
  FROM my_devices d
  WHERE source_type IN ('all', 'device')
    AND (
      d.prdlst_nm ILIKE like_q
      OR d.mnft_iprt_entp_nm ILIKE like_q
      OR d.udidi_cd ILIKE like_q
      OR d.foml_info ILIKE like_q
      OR d.prdt_nm_info ILIKE like_q
      OR d.permit_no ILIKE like_q
      OR extensions.similarity(COALESCE(d.prdlst_nm, ''), q) > 0.15
      OR extensions.similarity(COALESCE(d.mnft_iprt_entp_nm, ''), q) > 0.15
    )

  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════
-- 6. RPC: search_mfds_items
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION search_mfds_items(
  query TEXT,
  source_type TEXT DEFAULT 'drug',
  result_limit INT DEFAULT 30,
  page_num INT DEFAULT 1,
  page_size INT DEFAULT 30
)
RETURNS TABLE (
  id           BIGINT,
  item_type    TEXT,
  name         TEXT,
  code         TEXT,
  manufacturer TEXT,
  rank         REAL,
  raw_data     JSONB,
  total_count  BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  q TEXT := TRIM(query);
  like_q TEXT;
  off_val INT := (page_num - 1) * page_size;
BEGIN
  -- Empty query: return all items paginated
  IF q IS NULL OR q = '' THEN
    IF source_type = 'device' THEN
      RETURN QUERY
      SELECT
        d.id,
        'device'::TEXT AS item_type,
        d.prdlst_nm::TEXT AS name,
        d.udidi_cd::TEXT AS code,
        d.mnft_iprt_entp_nm::TEXT AS manufacturer,
        0::REAL AS rank,
        to_jsonb(d) AS raw_data,
        count(*) OVER()::BIGINT AS total_count
      FROM mfds_devices d
      ORDER BY d.prdlst_nm
      LIMIT page_size OFFSET off_val;
    ELSE
      RETURN QUERY
      SELECT
        d.id,
        'drug'::TEXT AS item_type,
        d.item_name::TEXT AS name,
        COALESCE(d.bar_code, d.edi_code)::TEXT AS code,
        d.entp_name::TEXT AS manufacturer,
        0::REAL AS rank,
        to_jsonb(d) AS raw_data,
        count(*) OVER()::BIGINT AS total_count
      FROM mfds_drugs d
      ORDER BY d.item_name
      LIMIT page_size OFFSET off_val;
    END IF;
    RETURN;
  END IF;

  like_q := '%' || q || '%';

  IF source_type = 'device' THEN
    RETURN QUERY
    SELECT
      d.id,
      'device'::TEXT AS item_type,
      d.prdlst_nm::TEXT AS name,
      d.udidi_cd::TEXT AS code,
      d.mnft_iprt_entp_nm::TEXT AS manufacturer,
      (
        CASE WHEN (
          d.prdlst_nm ILIKE like_q
          OR d.mnft_iprt_entp_nm ILIKE like_q
          OR d.udidi_cd ILIKE like_q
          OR d.permit_no ILIKE like_q
          OR d.foml_info ILIKE like_q
          OR d.prdt_nm_info ILIKE like_q
          OR d.use_purps_cont ILIKE like_q
        ) THEN 1 ELSE 0 END
        + GREATEST(
            extensions.similarity(COALESCE(d.prdlst_nm, ''), q),
            extensions.similarity(COALESCE(d.mnft_iprt_entp_nm, ''), q)
          )
      )::REAL AS rank,
      to_jsonb(d) AS raw_data,
      count(*) OVER()::BIGINT AS total_count
    FROM mfds_devices d
    WHERE
      d.prdlst_nm ILIKE like_q
      OR d.mnft_iprt_entp_nm ILIKE like_q
      OR d.udidi_cd ILIKE like_q
      OR d.permit_no ILIKE like_q
      OR d.foml_info ILIKE like_q
      OR d.prdt_nm_info ILIKE like_q
      OR d.use_purps_cont ILIKE like_q
      OR extensions.similarity(COALESCE(d.prdlst_nm, ''), q) > 0.15
      OR extensions.similarity(COALESCE(d.mnft_iprt_entp_nm, ''), q) > 0.15
    ORDER BY rank DESC
    LIMIT page_size OFFSET off_val;
  ELSE
    -- drug (default)
    RETURN QUERY
    SELECT
      d.id,
      'drug'::TEXT AS item_type,
      d.item_name::TEXT AS name,
      COALESCE(d.bar_code, d.edi_code)::TEXT AS code,
      d.entp_name::TEXT AS manufacturer,
      (
        CASE WHEN (
          d.item_name ILIKE like_q
          OR d.entp_name ILIKE like_q
          OR d.bar_code ILIKE like_q
          OR d.edi_code ILIKE like_q
          OR d.atc_code ILIKE like_q
          OR d.material_name ILIKE like_q
          OR d.main_item_ingr ILIKE like_q
        ) THEN 1 ELSE 0 END
        + GREATEST(
            extensions.similarity(COALESCE(d.item_name, ''), q),
            extensions.similarity(COALESCE(d.entp_name, ''), q)
          )
      )::REAL AS rank,
      to_jsonb(d) AS raw_data,
      count(*) OVER()::BIGINT AS total_count
    FROM mfds_drugs d
    WHERE
      d.item_name ILIKE like_q
      OR d.entp_name ILIKE like_q
      OR d.bar_code ILIKE like_q
      OR d.edi_code ILIKE like_q
      OR d.atc_code ILIKE like_q
      OR d.material_name ILIKE like_q
      OR d.main_item_ingr ILIKE like_q
      OR extensions.similarity(COALESCE(d.item_name, ''), q) > 0.15
      OR extensions.similarity(COALESCE(d.entp_name, ''), q) > 0.15
    ORDER BY rank DESC
    LIMIT page_size OFFSET off_val;
  END IF;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════
-- 7. RPC: search_hospitals
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION search_hospitals(
  query TEXT,
  result_limit INT DEFAULT 20
)
RETURNS TABLE (
  id             INT,
  name           VARCHAR,
  short_name     VARCHAR,
  address        TEXT,
  contact_person VARCHAR,
  phone          VARCHAR,
  hospital_type  TEXT,
  rank           REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  q TEXT := TRIM(query);
  like_q TEXT;
BEGIN
  -- Empty query: return active hospitals ordered by name
  IF q IS NULL OR q = '' THEN
    RETURN QUERY
    SELECT
      h.id,
      h.name,
      h.short_name,
      h.address,
      h.contact_person,
      h.phone,
      h.hospital_type::TEXT,
      0::REAL AS rank
    FROM hospitals h
    WHERE h.is_active = true
    ORDER BY h.name
    LIMIT result_limit;
    RETURN;
  END IF;

  like_q := '%' || q || '%';

  RETURN QUERY
  SELECT
    h.id,
    h.name,
    h.short_name,
    h.address,
    h.contact_person,
    h.phone,
    h.hospital_type::TEXT,
    (
      CASE WHEN (
        h.name::TEXT ILIKE like_q
        OR h.short_name::TEXT ILIKE like_q
        OR h.address ILIKE like_q
        OR h.contact_person::TEXT ILIKE like_q
        OR h.business_number::TEXT ILIKE like_q
      ) THEN 1 ELSE 0 END
      + GREATEST(
          extensions.similarity(COALESCE(h.name::TEXT, ''), q),
          extensions.similarity(COALESCE(h.short_name::TEXT, ''), q)
        )
    )::REAL AS rank
  FROM hospitals h
  WHERE h.is_active = true
    AND (
      h.name::TEXT ILIKE like_q
      OR h.short_name::TEXT ILIKE like_q
      OR h.address ILIKE like_q
      OR h.contact_person::TEXT ILIKE like_q
      OR h.business_number::TEXT ILIKE like_q
      OR extensions.similarity(COALESCE(h.name::TEXT, ''), q) > 0.15
      OR extensions.similarity(COALESCE(h.short_name::TEXT, ''), q) > 0.15
    )
  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════
-- 8. RPC: search_suppliers
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION search_suppliers(
  query TEXT,
  result_limit INT DEFAULT 20
)
RETURNS TABLE (
  id                INT,
  name              VARCHAR,
  short_name        VARCHAR,
  phone             VARCHAR,
  ceo_name          VARCHAR,
  business_category VARCHAR,
  rank              REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  q TEXT := TRIM(query);
  like_q TEXT;
BEGIN
  -- Empty query: return active suppliers ordered by name
  IF q IS NULL OR q = '' THEN
    RETURN QUERY
    SELECT
      s.id,
      s.name,
      s.short_name,
      s.phone,
      s.ceo_name,
      s.business_category,
      0::REAL AS rank
    FROM suppliers s
    WHERE s.is_active = true
    ORDER BY s.name
    LIMIT result_limit;
    RETURN;
  END IF;

  like_q := '%' || q || '%';

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.short_name,
    s.phone,
    s.ceo_name,
    s.business_category,
    (
      CASE WHEN (
        s.name::TEXT ILIKE like_q
        OR s.short_name::TEXT ILIKE like_q
        OR s.ceo_name::TEXT ILIKE like_q
        OR s.business_category::TEXT ILIKE like_q
        OR s.business_number::TEXT ILIKE like_q
      ) THEN 1 ELSE 0 END
      + GREATEST(
          extensions.similarity(COALESCE(s.name::TEXT, ''), q),
          extensions.similarity(COALESCE(s.short_name::TEXT, ''), q)
        )
    )::REAL AS rank
  FROM suppliers s
  WHERE s.is_active = true
    AND (
      s.name::TEXT ILIKE like_q
      OR s.short_name::TEXT ILIKE like_q
      OR s.ceo_name::TEXT ILIKE like_q
      OR s.business_category::TEXT ILIKE like_q
      OR s.business_number::TEXT ILIKE like_q
      OR extensions.similarity(COALESCE(s.name::TEXT, ''), q) > 0.15
      OR extensions.similarity(COALESCE(s.short_name::TEXT, ''), q) > 0.15
    )
  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════
-- 9. Permissions
-- ═══════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION search_my_items(TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_mfds_items(TEXT, TEXT, INT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_hospitals(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_suppliers(TEXT, INT) TO authenticated;
