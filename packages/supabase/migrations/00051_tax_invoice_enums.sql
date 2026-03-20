-- 00051_tax_invoice_enums.sql
-- Create ENUM types for tax invoice system

CREATE TYPE tax_invoice_status AS ENUM (
  'draft',
  'issued',
  'sent',
  'cancelled',
  'modified'
);

CREATE TYPE tax_invoice_type AS ENUM (
  'normal',
  'reverse'
);

CREATE TYPE tax_invoice_tax_type AS ENUM (
  'tax',
  'zero_rate',
  'exempt'
);

CREATE TYPE modify_reason AS ENUM (
  'return',
  'price_change',
  'quantity_change',
  'duplicate',
  'seller_info_change',
  'buyer_info_change',
  'other'
);
