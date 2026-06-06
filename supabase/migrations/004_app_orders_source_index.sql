CREATE INDEX IF NOT EXISTS idx_app_orders_source_created_at
  ON app_orders ((data->>'source'), created_at DESC);
