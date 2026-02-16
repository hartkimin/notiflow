-- Audit log for tracking order status changes and key actions
CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  table_name  VARCHAR(50) NOT NULL,
  record_id   INT NOT NULL,
  action      VARCHAR(20) NOT NULL,  -- INSERT, UPDATE, DELETE
  old_values  JSONB,
  new_values  JSONB,
  changed_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_table_record ON audit_logs (table_name, record_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at);

-- Trigger function: logs INSERT/UPDATE/DELETE on orders
CREATE OR REPLACE FUNCTION public.audit_order_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (table_name, record_id, action, old_values, changed_by)
    VALUES ('orders', OLD.id, 'DELETE', row_to_json(OLD)::jsonb, auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log if meaningful fields changed (not just updated_at)
    IF OLD.status IS DISTINCT FROM NEW.status
       OR OLD.delivery_date IS DISTINCT FROM NEW.delivery_date
       OR OLD.notes IS DISTINCT FROM NEW.notes
       OR OLD.total_amount IS DISTINCT FROM NEW.total_amount
    THEN
      INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, changed_by)
      VALUES (
        'orders', NEW.id, 'UPDATE',
        jsonb_build_object(
          'status', OLD.status,
          'delivery_date', OLD.delivery_date,
          'notes', OLD.notes,
          'total_amount', OLD.total_amount
        ),
        jsonb_build_object(
          'status', NEW.status,
          'delivery_date', NEW.delivery_date,
          'notes', NEW.notes,
          'total_amount', NEW.total_amount
        ),
        auth.uid()
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (table_name, record_id, action, new_values, changed_by)
    VALUES ('orders', NEW.id, 'INSERT',
      jsonb_build_object('order_number', NEW.order_number, 'status', NEW.status, 'hospital_id', NEW.hospital_id),
      auth.uid()
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_order_changes();

-- RLS: admin can read all, viewer can read all
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on audit_logs"
  ON audit_logs FOR ALL
  USING ((auth.jwt()->>'user_role') = 'admin');

CREATE POLICY "Viewer read audit_logs"
  ON audit_logs FOR SELECT
  USING ((auth.jwt()->>'user_role') = 'viewer');
