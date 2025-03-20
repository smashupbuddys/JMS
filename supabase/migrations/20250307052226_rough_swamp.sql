/*
  # Sales Analytics Fix

  1. Changes
    - Add missing columns and constraints
    - Update RLS policies
    - Fix analytics triggers

  2. Security
    - Enable RLS
    - Add proper policies
*/

-- Update daily_analytics structure
ALTER TABLE daily_analytics ADD COLUMN IF NOT EXISTS total_sales numeric DEFAULT 0;
ALTER TABLE daily_analytics ADD COLUMN IF NOT EXISTS items_sold integer DEFAULT 0;
ALTER TABLE daily_analytics ADD COLUMN IF NOT EXISTS hourly_sales jsonb DEFAULT '{}'::jsonb;

-- Enable RLS
ALTER TABLE daily_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE manufacturer_analytics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "daily_analytics_read_policy" ON daily_analytics;
DROP POLICY IF EXISTS "daily_analytics_write_policy" ON daily_analytics;
DROP POLICY IF EXISTS "sales_metrics_read_policy" ON sales_metrics;
DROP POLICY IF EXISTS "sales_metrics_write_policy" ON sales_metrics;
DROP POLICY IF EXISTS "manufacturer_analytics_read_policy" ON manufacturer_analytics;
DROP POLICY IF EXISTS "manufacturer_analytics_write_policy" ON manufacturer_analytics;

-- Create new policies
CREATE POLICY "daily_analytics_read_policy" 
ON daily_analytics FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "daily_analytics_write_policy" 
ON daily_analytics FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "sales_metrics_read_policy" 
ON sales_metrics FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "sales_metrics_write_policy" 
ON sales_metrics FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "manufacturer_analytics_read_policy" 
ON manufacturer_analytics FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "manufacturer_analytics_write_policy" 
ON manufacturer_analytics FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Create or replace the analytics update function
CREATE OR REPLACE FUNCTION update_daily_analytics()
RETURNS trigger AS $$
DECLARE
  v_total_sales numeric;
  v_items_sold integer;
  v_current_hour text;
  v_hourly_sales jsonb;
BEGIN
  -- Calculate totals
  SELECT 
    COALESCE(NEW.total_amount, 0),
    COALESCE((
      SELECT SUM((item->>'quantity')::integer)
      FROM jsonb_array_elements(NEW.items) item
    ), 0),
    to_char(CURRENT_TIMESTAMP, 'HH24')
  INTO v_total_sales, v_items_sold, v_current_hour;

  -- Get or initialize hourly sales
  SELECT COALESCE(hourly_sales, '{}'::jsonb)
  INTO v_hourly_sales
  FROM daily_analytics
  WHERE date = CURRENT_DATE;

  -- Update daily analytics
  INSERT INTO daily_analytics (
    date,
    total_sales,
    items_sold,
    hourly_sales
  ) VALUES (
    CURRENT_DATE,
    v_total_sales,
    v_items_sold,
    jsonb_set(
      COALESCE(v_hourly_sales, '{}'::jsonb),
      ARRAY[v_current_hour],
      to_jsonb(COALESCE((v_hourly_sales->>v_current_hour)::numeric, 0) + v_total_sales)
    )
  )
  ON CONFLICT (date) 
  DO UPDATE SET
    total_sales = daily_analytics.total_sales + v_total_sales,
    items_sold = daily_analytics.items_sold + v_items_sold,
    hourly_sales = jsonb_set(
      COALESCE(daily_analytics.hourly_sales, '{}'::jsonb),
      ARRAY[v_current_hour],
      to_jsonb(
        COALESCE((daily_analytics.hourly_sales->>v_current_hour)::numeric, 0) + v_total_sales
      )
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;