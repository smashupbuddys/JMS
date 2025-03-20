/*
  # Fix daily analytics trigger

  1. Changes
    - Fix sales_metrics table to use UUID primary key
    - Update trigger functions to handle UUID
    - Add proper error handling
    - Add more detailed analytics tracking

  2. Improvements
    - Better handling of NULL values
    - More robust aggregation functions
    - Improved data validation
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily NUMERIC DEFAULT 0,
  weekly NUMERIC DEFAULT 0,
  monthly NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial sales metrics record if not exists
INSERT INTO sales_metrics (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM sales_metrics LIMIT 1);

-- Function to update daily analytics
CREATE OR REPLACE FUNCTION update_daily_analytics()
RETURNS TRIGGER AS $$
DECLARE
  sale_date DATE;
  total_items INTEGER;
  customer_type TEXT;
  payment_method TEXT;
BEGIN
  -- Get the sale date
  sale_date := CURRENT_DATE;
  
  -- Calculate total items
  SELECT COALESCE(SUM((item->>'quantity')::INTEGER), 0)
  INTO total_items
  FROM jsonb_array_elements(NEW.items) item;

  -- Get customer type and payment method
  SELECT COALESCE(c.type, 'retail'), COALESCE(NEW.payment_details->'payments'->0->>'method', 'cash')
  INTO customer_type, payment_method
  FROM customers c
  WHERE c.id = NEW.customer_id;

  -- Update daily analytics with error handling
  BEGIN
    INSERT INTO daily_analytics (
      date,
      total_sales_amount,
      total_items_sold,
      payment_collection,
      bills_generated_count,
      stats
    ) VALUES (
      sale_date,
      COALESCE(NEW.total_amount, 0),
      total_items,
      CASE 
        WHEN NEW.payment_details->>'payment_status' = 'completed' THEN COALESCE(NEW.total_amount, 0)
        WHEN NEW.payment_details->>'payment_status' = 'partial' THEN COALESCE((NEW.payment_details->>'paid_amount')::NUMERIC, 0)
        ELSE 0
      END,
      1,
      jsonb_build_object(
        'categories', (
          SELECT jsonb_object_agg(
            COALESCE(item->'product'->>'category', 'uncategorized'),
            COALESCE((item->>'quantity')::INTEGER, 0)
          )
          FROM jsonb_array_elements(NEW.items) AS item
        ),
        'payment_methods', jsonb_build_object(
          payment_method, 1
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
            COALESCE(daily_analytics.stats, '{}'::jsonb),
            '{categories}',
            COALESCE(daily_analytics.stats->'categories', '{}'::jsonb) || 
            COALESCE(EXCLUDED.stats->'categories', '{}'::jsonb)
          ),
          '{payment_methods}',
          COALESCE(daily_analytics.stats->'payment_methods', '{}'::jsonb) || 
          COALESCE(EXCLUDED.stats->'payment_methods', '{}'::jsonb)
        ),
        '{customer_types}',
        COALESCE(daily_analytics.stats->'customer_types', '{}'::jsonb) || 
        COALESCE(EXCLUDED.stats->'customer_types', '{}'::jsonb)
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error updating daily analytics: %', SQLERRM;
    RETURN NEW;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update sales metrics
CREATE OR REPLACE FUNCTION update_sales_metrics()
RETURNS TRIGGER AS $$
DECLARE
  metrics_id UUID;
BEGIN
  -- Get the ID of the metrics record (there should only be one)
  SELECT id INTO metrics_id FROM sales_metrics LIMIT 1;
  
  IF metrics_id IS NULL THEN
    -- Create new record if none exists
    INSERT INTO sales_metrics (id) VALUES (gen_random_uuid())
    RETURNING id INTO metrics_id;
  END IF;

  -- Update sales metrics with error handling
  BEGIN
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
    WHERE id = metrics_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error updating sales metrics: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace triggers
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