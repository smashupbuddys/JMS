/*
  # Sales Analytics Structure Update

  1. Tables Modified
    - daily_analytics
    - sales_metrics 
    - manufacturer_analytics

  2. Changes
    - Add missing columns for analytics
    - Update table structures
    - Add proper indexes
    - Set up RLS policies

  3. Security
    - Authenticated users can view analytics
    - Insert/update allowed for sales completion
*/

-- Update daily_analytics structure
DO $$ BEGIN
  -- Add missing columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_analytics' AND column_name = 'total_sales'
  ) THEN
    ALTER TABLE daily_analytics 
    ADD COLUMN total_sales numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_analytics' AND column_name = 'items_sold'
  ) THEN
    ALTER TABLE daily_analytics 
    ADD COLUMN items_sold integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_analytics' AND column_name = 'hourly_sales'
  ) THEN
    ALTER TABLE daily_analytics 
    ADD COLUMN hourly_sales jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_analytics_date ON daily_analytics(date);
CREATE INDEX IF NOT EXISTS idx_daily_analytics_total_sales ON daily_analytics((total_sales));
CREATE INDEX IF NOT EXISTS idx_daily_analytics_items_sold ON daily_analytics((items_sold));

-- Update sales_metrics structure
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales_metrics' AND column_name = 'daily_sales'
  ) THEN
    ALTER TABLE sales_metrics 
    ADD COLUMN daily_sales numeric DEFAULT 0;
  END IF;
END $$;

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

-- Create function to update daily analytics
CREATE OR REPLACE FUNCTION update_daily_analytics()
RETURNS trigger AS $$
DECLARE
  current_hour text;
  current_sales jsonb;
BEGIN
  -- Get current hour
  current_hour := to_char(CURRENT_TIMESTAMP, 'HH24');
  
  -- Get or initialize hourly sales
  current_sales := COALESCE(
    (SELECT hourly_sales FROM daily_analytics WHERE date = CURRENT_DATE),
    '{}'::jsonb
  );
  
  -- Update or insert daily analytics
  INSERT INTO daily_analytics (
    date,
    total_sales,
    items_sold,
    hourly_sales
  ) VALUES (
    CURRENT_DATE,
    COALESCE(NEW.total_amount, 0),
    COALESCE((
      SELECT SUM(item->>'quantity')::integer 
      FROM jsonb_array_elements(NEW.items) item
    ), 0),
    jsonb_set(
      current_sales,
      array[current_hour],
      to_jsonb(COALESCE(
        (current_sales->current_hour)::numeric, 0
      ) + COALESCE(NEW.total_amount, 0))
    )
  )
  ON CONFLICT (date) DO UPDATE SET
    total_sales = daily_analytics.total_sales + EXCLUDED.total_sales,
    items_sold = daily_analytics.items_sold + EXCLUDED.items_sold,
    hourly_sales = daily_analytics.hourly_sales || EXCLUDED.hourly_sales;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for daily analytics
DROP TRIGGER IF EXISTS update_daily_analytics_trigger ON quotations;
CREATE TRIGGER update_daily_analytics_trigger
  AFTER INSERT OR UPDATE OF status ON quotations
  FOR EACH ROW
  WHEN (NEW.status = 'accepted')
  EXECUTE FUNCTION update_daily_analytics();