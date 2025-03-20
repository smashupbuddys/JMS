/*
  # Add daily analytics trigger

  1. New Tables
    - `daily_analytics` - Stores daily sales metrics and analytics
    - `sales_metrics` - Stores real-time sales metrics

  2. Functions
    - `update_daily_analytics()` - Updates daily sales metrics in real-time
    - `update_sales_metrics()` - Updates overall sales metrics

  3. Changes
    - Add real-time analytics updates for sales dashboard
    - Add daily metrics tracking
*/

-- Create daily_analytics table if not exists
CREATE TABLE IF NOT EXISTS daily_analytics (
  date DATE PRIMARY KEY,
  video_calls_count INTEGER DEFAULT 0,
  bills_generated_count INTEGER DEFAULT 0,
  total_sales_amount NUMERIC DEFAULT 0,
  total_items_sold INTEGER DEFAULT 0,
  payment_collection NUMERIC DEFAULT 0,
  stats JSONB DEFAULT '{
    "categories": {},
    "payment_methods": {},
    "customer_types": {"retail": 0, "wholesale": 0}
  }'::jsonb
);

-- Create sales_metrics table if not exists
CREATE TABLE IF NOT EXISTS sales_metrics (
  id SERIAL PRIMARY KEY,
  daily NUMERIC DEFAULT 0,
  weekly NUMERIC DEFAULT 0,
  monthly NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial sales metrics record if not exists
INSERT INTO sales_metrics (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Function to update daily analytics
CREATE OR REPLACE FUNCTION update_daily_analytics()
RETURNS TRIGGER AS $$
DECLARE
  sale_date DATE;
  total_items INTEGER;
  customer_type TEXT;
BEGIN
  -- Get the sale date
  sale_date := CURRENT_DATE;
  
  -- Calculate total items
  SELECT COALESCE(SUM((item->>'quantity')::INTEGER), 0)
  INTO total_items
  FROM jsonb_array_elements(NEW.items) item;

  -- Get customer type
  SELECT COALESCE(c.type, 'retail')
  INTO customer_type
  FROM customers c
  WHERE c.id = NEW.customer_id;

  -- Update daily analytics
  INSERT INTO daily_analytics (
    date,
    total_sales_amount,
    total_items_sold,
    payment_collection,
    bills_generated_count,
    stats
  ) VALUES (
    sale_date,
    NEW.total_amount,
    total_items,
    CASE 
      WHEN NEW.payment_details->>'payment_status' = 'completed' THEN NEW.total_amount
      WHEN NEW.payment_details->>'payment_status' = 'partial' THEN (NEW.payment_details->>'paid_amount')::NUMERIC
      ELSE 0
    END,
    1,
    jsonb_build_object(
      'categories', (
        SELECT jsonb_object_agg(
          (item->'product'->>'category'),
          (item->>'quantity')::INTEGER
        )
        FROM jsonb_array_elements(NEW.items) AS item
      ),
      'payment_methods', jsonb_build_object(
        COALESCE(NEW.payment_details->'payments'->0->>'method', 'cash'), 1
      ),
      'customer_types', jsonb_build_object(
        customer_type, 1
      )
    )
  )
  ON CONFLICT (date) DO UPDATE SET
    total_sales_amount = daily_analytics.total_sales_amount + EXCLUDED.total_sales_amount,
    total_items_sold = daily_analytics.total_items_sold + EXCLUDED.total_items_sold,
    payment_collection = daily_analytics.payment_collection + EXCLUDED.payment_collection,
    bills_generated_count = daily_analytics.bills_generated_count + 1,
    stats = jsonb_set(
      jsonb_set(
        jsonb_set(
          daily_analytics.stats,
          '{categories}',
          daily_analytics.stats->'categories' || EXCLUDED.stats->'categories'
        ),
        '{payment_methods}',
        daily_analytics.stats->'payment_methods' || EXCLUDED.stats->'payment_methods'
      ),
      '{customer_types}',
      daily_analytics.stats->'customer_types' || EXCLUDED.stats->'customer_types'
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update sales metrics
CREATE OR REPLACE FUNCTION update_sales_metrics()
RETURNS TRIGGER AS $$
DECLARE
  today_start TIMESTAMPTZ;
  week_start TIMESTAMPTZ;
  month_start TIMESTAMPTZ;
BEGIN
  -- Calculate period starts
  today_start := date_trunc('day', NOW());
  week_start := date_trunc('week', NOW());
  month_start := date_trunc('month', NOW());

  -- Update sales metrics
  UPDATE sales_metrics
  SET
    daily = (
      SELECT COALESCE(SUM(total_sales_amount), 0)
      FROM daily_analytics
      WHERE date = CURRENT_DATE
    ),
    weekly = (
      SELECT COALESCE(SUM(total_sales_amount), 0)
      FROM daily_analytics
      WHERE date >= date_trunc('week', CURRENT_DATE)
    ),
    monthly = (
      SELECT COALESCE(SUM(total_sales_amount), 0)
      FROM daily_analytics
      WHERE date >= date_trunc('month', CURRENT_DATE)
    ),
    total = (
      SELECT COALESCE(SUM(total_sales_amount), 0)
      FROM daily_analytics
    ),
    last_updated = NOW()
  WHERE id = 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS update_daily_analytics_trigger ON quotations;
CREATE TRIGGER update_daily_analytics_trigger
  AFTER INSERT OR UPDATE ON quotations
  FOR EACH ROW
  WHEN (NEW.status = 'accepted')
  EXECUTE FUNCTION update_daily_analytics();

DROP TRIGGER IF EXISTS update_sales_metrics_trigger ON daily_analytics;
CREATE TRIGGER update_sales_metrics_trigger
  AFTER INSERT OR UPDATE ON daily_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_metrics();