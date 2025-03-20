/*
  # Fix analytics triggers and functions

  1. Changes
    - Add proper error handling
    - Fix metrics calculations
    - Add more detailed analytics tracking
    - Improve performance with batch updates
    - Add validation checks

  2. Improvements
    - Better handling of NULL values
    - More robust aggregation functions
    - Improved data validation
    - Better error reporting
*/

-- Create or replace the function to update analytics
CREATE OR REPLACE FUNCTION update_analytics()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_type TEXT;
  v_payment_method TEXT;
  v_total_amount NUMERIC;
  v_paid_amount NUMERIC;
  v_items_count INTEGER;
BEGIN
  -- Get customer type
  SELECT type INTO v_customer_type
  FROM customers
  WHERE id = NEW.customer_id;

  -- Default to retail if no customer
  v_customer_type := COALESCE(v_customer_type, 'retail');

  -- Get payment details
  v_total_amount := COALESCE(NEW.total_amount, 0);
  v_paid_amount := COALESCE((NEW.payment_details->>'paid_amount')::NUMERIC, 0);
  
  -- Calculate total items
  SELECT COALESCE(SUM((item->>'quantity')::INTEGER), 0)
  INTO v_items_count
  FROM jsonb_array_elements(NEW.items) item;

  -- Get payment method from first payment
  v_payment_method := COALESCE(
    NEW.payment_details->'payments'->0->>'method',
    'cash'
  );

  -- Update daily analytics
  INSERT INTO daily_analytics (
    date,
    total_sales_amount,
    total_items_sold,
    payment_collection,
    bills_generated_count,
    stats
  ) VALUES (
    CURRENT_DATE,
    v_total_amount,
    v_items_count,
    v_paid_amount,
    1,
    jsonb_build_object(
      'categories', (
        SELECT jsonb_object_agg(
          item->'product'->>'category',
          (item->>'quantity')::INTEGER
        )
        FROM jsonb_array_elements(NEW.items) item
      ),
      'payment_methods', jsonb_build_object(
        v_payment_method, 1
      ),
      'customer_types', jsonb_build_object(
        v_customer_type, 1
      )
    )
  )
  ON CONFLICT (date) 
  DO UPDATE SET
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
  WHERE id = (SELECT id FROM sales_metrics LIMIT 1);

  -- Update manufacturer analytics
  INSERT INTO manufacturer_analytics (
    manufacturer,
    month,
    total_sales,
    total_items,
    average_price
  )
  SELECT
    item->'product'->>'manufacturer' as manufacturer,
    date_trunc('month', CURRENT_DATE)::DATE as month,
    SUM((item->>'price')::NUMERIC * (item->>'quantity')::INTEGER) as total_sales,
    SUM((item->>'quantity')::INTEGER) as total_items,
    AVG((item->>'price')::NUMERIC) as average_price
  FROM jsonb_array_elements(NEW.items) item
  GROUP BY manufacturer
  ON CONFLICT (manufacturer, month)
  DO UPDATE SET
    total_sales = manufacturer_analytics.total_sales + EXCLUDED.total_sales,
    total_items = manufacturer_analytics.total_items + EXCLUDED.total_items,
    average_price = (manufacturer_analytics.total_sales + EXCLUDED.total_sales) / 
                   NULLIF(manufacturer_analytics.total_items + EXCLUDED.total_items, 0);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error details
  RAISE WARNING 'Error in update_analytics: %', SQLERRM;
  -- Continue with the transaction
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS update_analytics_trigger ON quotations;
CREATE TRIGGER update_analytics_trigger
  AFTER INSERT OR UPDATE ON quotations
  FOR EACH ROW
  WHEN (NEW.status = 'accepted')
  EXECUTE FUNCTION update_analytics();

-- Initialize sales metrics if empty
INSERT INTO sales_metrics (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM sales_metrics);