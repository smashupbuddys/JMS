/*
  # Sales Analytics Security Policies

  1. Tables Modified
    - daily_analytics
    - sales_metrics
    - manufacturer_analytics

  2. Changes
    - Enable RLS on analytics tables
    - Add unified policies for authenticated users
    - Set up triggers for analytics updates

  3. Security
    - Authenticated users can view analytics
    - Public access restricted
    - Data integrity maintained through triggers
*/

-- Enable RLS on analytics tables
ALTER TABLE daily_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE manufacturer_analytics ENABLE ROW LEVEL SECURITY;

-- Drop any existing conflicting policies
DROP POLICY IF EXISTS "Allow admin read access on daily_analytics" ON daily_analytics;
DROP POLICY IF EXISTS "Allow authenticated users to view daily analytics" ON daily_analytics;
DROP POLICY IF EXISTS "Allow public read access on daily_analytics" ON daily_analytics;
DROP POLICY IF EXISTS "Allow public insert access on daily_analytics" ON daily_analytics;
DROP POLICY IF EXISTS "Allow public update access on daily_analytics" ON daily_analytics;
DROP POLICY IF EXISTS "Allow authenticated users to view sales metrics" ON sales_metrics;
DROP POLICY IF EXISTS "Allow authenticated read access" ON manufacturer_analytics;
DROP POLICY IF EXISTS "Allow authenticated users to view manufacturer analytics" ON manufacturer_analytics;
DROP POLICY IF EXISTS "Full access to authenticated users" ON manufacturer_analytics;

-- Create unified policies for daily_analytics
CREATE POLICY "daily_analytics_read_policy"
  ON daily_analytics
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "daily_analytics_insert_policy"
  ON daily_analytics
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "daily_analytics_update_policy"
  ON daily_analytics
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create unified policies for sales_metrics
CREATE POLICY "sales_metrics_read_policy"
  ON sales_metrics
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "sales_metrics_write_policy"
  ON sales_metrics
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create unified policies for manufacturer_analytics
CREATE POLICY "manufacturer_analytics_read_policy"
  ON manufacturer_analytics
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "manufacturer_analytics_write_policy"
  ON manufacturer_analytics
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create or replace trigger function for sales metrics
CREATE OR REPLACE FUNCTION update_sales_metrics()
RETURNS trigger AS $$
BEGIN
  INSERT INTO sales_metrics (
    daily_sales,
    weekly_sales,
    monthly_sales,
    total_sales,
    last_updated
  )
  VALUES (
    NEW.total_sales_amount,
    (
      SELECT COALESCE(SUM(total_sales_amount), 0)
      FROM daily_analytics
      WHERE date >= CURRENT_DATE - INTERVAL '7 days'
    ),
    (
      SELECT COALESCE(SUM(total_sales_amount), 0)
      FROM daily_analytics
      WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
    ),
    (
      SELECT COALESCE(SUM(total_sales_amount), 0)
      FROM daily_analytics
    ),
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (id) DO UPDATE SET
    daily_sales = EXCLUDED.daily_sales,
    weekly_sales = EXCLUDED.weekly_sales,
    monthly_sales = EXCLUDED.monthly_sales,
    total_sales = EXCLUDED.total_sales,
    last_updated = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace trigger function for manufacturer analytics timestamp
CREATE OR REPLACE FUNCTION update_manufacturer_analytics_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on manufacturer_analytics
DROP TRIGGER IF EXISTS update_manufacturer_analytics_timestamp ON manufacturer_analytics;
CREATE TRIGGER update_manufacturer_analytics_timestamp
  BEFORE UPDATE ON manufacturer_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_manufacturer_analytics_updated_at();

-- Create trigger for sales metrics updates
DROP TRIGGER IF EXISTS update_sales_metrics_trigger ON daily_analytics;
CREATE TRIGGER update_sales_metrics_trigger
  AFTER INSERT OR UPDATE ON daily_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_metrics();