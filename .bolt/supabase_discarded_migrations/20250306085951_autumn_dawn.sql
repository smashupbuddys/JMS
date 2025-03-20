/*
  # Add sales metrics tracking functions

  1. Functions
    - `calculate_sales_metrics()` - Calculates daily, weekly, monthly and total sales
    - `update_sales_metrics()` - Trigger function to update metrics on new sales

  2. Tables
    - `sales_metrics` - Stores aggregated sales metrics
      - daily_sales
      - weekly_sales  
      - monthly_sales
      - total_sales
      - last_updated

  3. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create sales metrics table
CREATE TABLE IF NOT EXISTS sales_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_sales numeric DEFAULT 0,
  weekly_sales numeric DEFAULT 0,
  monthly_sales numeric DEFAULT 0,
  total_sales numeric DEFAULT 0,
  last_updated timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE sales_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to view sales metrics"
  ON sales_metrics
  FOR SELECT
  TO authenticated
  USING (true);

-- Function to calculate sales metrics
CREATE OR REPLACE FUNCTION calculate_sales_metrics()
RETURNS void AS $$
DECLARE
  daily numeric;
  weekly numeric;
  monthly numeric;
  total numeric;
BEGIN
  -- Calculate daily sales
  SELECT COALESCE(SUM(total_amount), 0)
  INTO daily
  FROM quotations
  WHERE status = 'accepted'
  AND created_at >= CURRENT_DATE;

  -- Calculate weekly sales
  SELECT COALESCE(SUM(total_amount), 0)
  INTO weekly
  FROM quotations
  WHERE status = 'accepted'
  AND created_at >= date_trunc('week', CURRENT_DATE);

  -- Calculate monthly sales
  SELECT COALESCE(SUM(total_amount), 0)
  INTO monthly
  FROM quotations
  WHERE status = 'accepted'
  AND created_at >= date_trunc('month', CURRENT_DATE);

  -- Calculate total sales
  SELECT COALESCE(SUM(total_amount), 0)
  INTO total
  FROM quotations
  WHERE status = 'accepted';

  -- Update or insert metrics
  INSERT INTO sales_metrics (
    daily_sales,
    weekly_sales,
    monthly_sales,
    total_sales,
    last_updated
  )
  VALUES (
    daily,
    weekly,
    monthly,
    total,
    now()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    daily_sales = EXCLUDED.daily_sales,
    weekly_sales = EXCLUDED.weekly_sales,
    monthly_sales = EXCLUDED.monthly_sales,
    total_sales = EXCLUDED.total_sales,
    last_updated = EXCLUDED.last_updated;
END;
$$ LANGUAGE plpgsql;

-- Function to update metrics on new sale
CREATE OR REPLACE FUNCTION update_sales_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update metrics for accepted quotations
  IF NEW.status = 'accepted' THEN
    PERFORM calculate_sales_metrics();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for quotations
CREATE TRIGGER update_sales_metrics_on_quotation
  AFTER INSERT OR UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_metrics();

-- Initialize metrics
SELECT calculate_sales_metrics();