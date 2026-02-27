-- Add source_message_id to orders for linking to captured_messages
ALTER TABLE orders
  ADD COLUMN source_message_id TEXT
  REFERENCES captured_messages(id) ON DELETE SET NULL;

CREATE INDEX idx_orders_source_message_id ON orders(source_message_id);
