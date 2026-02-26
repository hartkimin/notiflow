-- ============================================================
-- 24. Backfill: Link existing products to mfds_items
-- Run AFTER initial sync has populated mfds_items table
-- ============================================================

-- Drug products (auto_info source = mfds_drug_api)
UPDATE products p SET mfds_item_id = m.id
FROM mfds_items m
WHERE p.auto_info->>'source' = 'mfds_drug_api'
  AND m.source_type = 'drug'
  AND m.source_key = p.auto_info->>'item_seq'
  AND p.mfds_item_id IS NULL;

-- Device products (auto_info source = mfds_device_api)
UPDATE products p SET mfds_item_id = m.id
FROM mfds_items m
WHERE p.auto_info->>'source' = 'mfds_device_api'
  AND m.source_type = 'device'
  AND m.source_key = p.auto_info->>'prdlst_sn'
  AND p.mfds_item_id IS NULL;

-- Device Std products (auto_info source = mfds_device_std_api)
UPDATE products p SET mfds_item_id = m.id
FROM mfds_items m
WHERE p.auto_info->>'source' = 'mfds_device_std_api'
  AND m.source_type = 'device_std'
  AND m.source_key = p.auto_info->>'udidi_cd'
  AND p.mfds_item_id IS NULL;
