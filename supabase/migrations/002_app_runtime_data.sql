CREATE TABLE IF NOT EXISTS app_customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_orders (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_orders_created_at ON app_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_orders_status ON app_orders(status);
CREATE INDEX IF NOT EXISTS idx_app_orders_customer_email ON app_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_app_customers_email ON app_customers(email);

ALTER TABLE app_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage app customers"
  ON app_customers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can manage app orders"
  ON app_orders FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
