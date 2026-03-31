-- 00068_tax_invoice_order_guard.sql
-- Prevents an order from being linked to more than one active invoice.
-- "Active" means status is not 'cancelled'.

CREATE OR REPLACE FUNCTION check_invoice_order_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM tax_invoice_orders tio
    JOIN tax_invoices ti ON ti.id = tio.invoice_id
    WHERE tio.order_id = NEW.order_id
      AND ti.status NOT IN ('cancelled')
  ) THEN
    RAISE EXCEPTION
      'Order % is already linked to an active invoice', NEW.order_id
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_duplicate_invoice_order
  BEFORE INSERT ON tax_invoice_orders
  FOR EACH ROW
  EXECUTE FUNCTION check_invoice_order_uniqueness();
