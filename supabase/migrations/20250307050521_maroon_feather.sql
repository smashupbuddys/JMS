/*
  # Update Daily Analytics Schema for Items Sold

  1. New Columns
    - Add items_sold column for tracking total items sold
    - Add total_items_sold for aggregate count
    - Update analytics function to track items properly

  2. Changes
    - Add items_sold column with default value
    - Update analytics function to track item counts
    - Maintain existing functionality
*/

-- Add items_sold column if it doesn't exist
ALTER TABLE daily_analytics 
  ADD COLUMN IF NOT EXISTS total_items_sold integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items_sold jsonb DEFAULT '{}'::jsonb;

-- Update the analytics function to track items sold
CREATE OR REPLACE FUNCTION update_daily_analytics() 
RETURNS trigger AS $$
DECLARE
  v_date date;
  v_hour text;
  v_payment_method text;
  v_customer_type text;
  v_amount numeric;
  v_items_count integer;
  v_items_data jsonb;
BEGIN
  -- Get the current date and hour
  v_date := CURRENT_DATE;
  v_hour := to_char(CURRENT_TIMESTAMP, 'HH24');
  
  -- Get sale details
  v_amount := NEW.total_amount;
  v_payment_method := COALESCE((NEW.payment_details->>'payment_method')::text, 'other');
  v_customer_type := CASE 
    WHEN NEW.customer_id IS NULL THEN 'retail'
    ELSE (SELECT type FROM customers WHERE id = NEW.customer_id)
  END;

  -- Calculate items count and prepare items data
  SELECT 
    SUM((item->>'quantity')::integer),
    jsonb_object_agg(
      item->'product'->>'category',
      (item->>'quantity')::integer
    )
  INTO v_items_count, v_items_data
  FROM jsonb_array_elements(NEW.items) AS item;

  -- Insert or update daily analytics
  INSERT INTO daily_analytics (
    date,
    total_sales_amount,
    bills_generated_count,
    total_items_sold,
    items_sold,
    hourly_sales,
    payment_methods,
    stats
  ) VALUES (
    v_date,
    v_amount,
    1,
    COALESCE(v_items_count, 0),
    COALESCE(v_items_data, '{}'::jsonb),
    jsonb_build_object(v_hour, v_amount),
    jsonb_build_object(v_payment_method, v_amount),
    jsonb_build_object(
      'categories', v_items_data,
      'customer_types', jsonb_build_object(v_customer_type, 1),
      'payment_methods', jsonb_build_object(v_payment_method, 1)
    )
  )
  ON CONFLICT (date) DO UPDATE SET
    total_sales_amount = daily_analytics.total_sales_amount + v_amount,
    bills_generated_count = daily_analytics.bills_generated_count + 1,
    total_items_sold = daily_analytics.total_items_sold + COALESCE(v_items_count, 0),
    items_sold = daily_analytics.items_sold || 
      COALESCE(v_items_data, '{}'::jsonb),
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS update_daily_analytics_trigger ON quotations;

CREATE TRIGGER update_daily_analytics_trigger
  AFTER INSERT OR UPDATE OF status ON quotations
  FOR EACH ROW
  WHEN (NEW.status = 'accepted')
  EXECUTE FUNCTION update_daily_analytics();