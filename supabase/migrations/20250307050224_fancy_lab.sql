/*
  # Update Daily Analytics Schema

  1. New Columns
    - Add hourly_sales JSONB column for tracking sales by hour
    - Add payment_methods JSONB column for tracking payment methods
    - Add stats JSONB column for detailed statistics
    - Add customer_segments JSONB column for customer analysis

  2. Default Values
    - Set appropriate default values for all new columns
    - Ensure backward compatibility

  3. Security
    - Maintain existing RLS policies
*/

-- Add new columns to daily_analytics table with default values
ALTER TABLE daily_analytics 
  ADD COLUMN IF NOT EXISTS hourly_sales jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_methods jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_segments jsonb DEFAULT '{"new": 0, "returning": 0}'::jsonb,
  ADD COLUMN IF NOT EXISTS stats jsonb DEFAULT jsonb_build_object(
    'categories', '{}',
    'customer_types', jsonb_build_object('retail', 0, 'wholesale', 0),
    'payment_methods', '{}'
  );

-- Create function to update daily analytics
CREATE OR REPLACE FUNCTION update_daily_analytics() 
RETURNS trigger AS $$
DECLARE
  v_date date;
  v_hour text;
  v_payment_method text;
  v_customer_type text;
  v_amount numeric;
BEGIN
  -- Get the current date and hour
  v_date := CURRENT_DATE;
  v_hour := to_char(CURRENT_TIMESTAMP, 'HH24');
  
  -- Get sale details
  v_amount := NEW.total_amount;
  v_payment_method := COALESCE(NEW.payment_details->>'payment_method', 'other');
  v_customer_type := CASE 
    WHEN NEW.customer_id IS NULL THEN 'retail'
    ELSE (SELECT type FROM customers WHERE id = NEW.customer_id)
  END;

  -- Insert or update daily analytics
  INSERT INTO daily_analytics (
    date,
    total_sales_amount,
    bills_generated_count,
    hourly_sales,
    payment_methods,
    stats
  ) VALUES (
    v_date,
    v_amount,
    1,
    jsonb_build_object(v_hour, v_amount),
    jsonb_build_object(v_payment_method, v_amount),
    jsonb_build_object(
      'categories', '{}',
      'customer_types', jsonb_build_object(v_customer_type, 1),
      'payment_methods', jsonb_build_object(v_payment_method, 1)
    )
  )
  ON CONFLICT (date) DO UPDATE SET
    total_sales_amount = daily_analytics.total_sales_amount + v_amount,
    bills_generated_count = daily_analytics.bills_generated_count + 1,
    hourly_sales = daily_analytics.hourly_sales || 
      jsonb_build_object(
        v_hour, 
        COALESCE((daily_analytics.hourly_sales->>v_hour)::numeric, 0) + v_amount
      ),
    payment_methods = daily_analytics.payment_methods || 
      jsonb_build_object(
        v_payment_method, 
        COALESCE((daily_analytics.payment_methods->>v_payment_method)::numeric, 0) + v_amount
      ),
    stats = jsonb_set(
      jsonb_set(
        daily_analytics.stats,
        '{customer_types}'::text[],
        jsonb_build_object(
          v_customer_type,
          COALESCE((daily_analytics.stats->'customer_types'->v_customer_type)::numeric, 0) + 1
        )
      ),
      '{payment_methods}'::text[],
      jsonb_build_object(
        v_payment_method,
        COALESCE((daily_analytics.stats->'payment_methods'->v_payment_method)::numeric, 0) + 1
      )
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_daily_analytics_trigger ON quotations;

-- Create new trigger
CREATE TRIGGER update_daily_analytics_trigger
  AFTER INSERT OR UPDATE OF status ON quotations
  FOR EACH ROW
  WHEN (NEW.status = 'accepted')
  EXECUTE FUNCTION update_daily_analytics();

-- Add index for faster analytics queries
CREATE INDEX IF NOT EXISTS idx_daily_analytics_date ON daily_analytics(date);