-- 00022: Add order_comments table for per-order comment threads

CREATE TABLE order_comments (
  id          SERIAL PRIMARY KEY,
  order_id    INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_comments_order ON order_comments(order_id);

-- RLS
ALTER TABLE order_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read order comments"
  ON order_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert order comments"
  ON order_comments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete own comments"
  ON order_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
