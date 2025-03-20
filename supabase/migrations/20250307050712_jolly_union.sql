/*
  # Update Daily Analytics Schema for Total Sales

  1. New Columns
    - Add total_sales column for tracking total daily sales
    - Add total_revenue column for tracking total revenue
    - Add total_items column for tracking total items sold
    - Add purchases jsonb column for detailed purchase tracking
    - Add top_categories jsonb for category analysis
    - Add monthly_trend jsonb for trend analysis

  2. Changes
    - Add new columns with appropriate defaults
    - Update analytics function to track all metrics
    - Maintain existing functionality
*/

-- Add new columns to daily_analytics if they don't exist
ALTER TABLE daily_analytics 
  ADD COLUMN IF NOT EXISTS total_sales numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_revenue numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_items integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchases jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS top_categories jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS monthly_trend jsonb DEFAULT '{}'::jsonb;

-- Update the analytics function to track total sales
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
  v_categories jsonb;
  v_month text;
BEGIN
  -- Get the current date and hour
  v_date := CURRENT_DATE;
  v_hour := to_char(CURRENT_TIMESTAMP, 'HH24');
  v_month := to_char(CURRENT_DATE, 'YYYY-MM');
  
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
  INTO v_items_count, v_categories
  FROM jsonb_array_elements(NEW.items) AS item;

  -- Prepare purchase data
  v_items_data := jsonb_build_object(
    'id', NEW.id,
    'amount', v_amount,
    'items_count', COALESCE(v_items_count, 0),
    'categories', v_categories,
    'customer_type', v_customer_type,
    'payment_method', v_payment_method,
    'created_at', CURRENT_TIMESTAMP
  );

  -- Insert or update daily analytics
  INSERT INTO daily_analytics (
    date,
    total_sales_amount,
    bills_generated_count,
    total_items_sold,
    total_sales,
    total_revenue,
    total_items,
    purchases,
    stats
  ) VALUES (
    v_date,
    v_amount,
    1,
    COALESCE(v_items_count, 0),
    1, -- Increment total sales count
    v_amount, -- Add to total revenue
    COALESCE(v_items_count, 0), -- Add to total items
    jsonb_build_array(v_items_data), -- Initialize purchases array
    jsonb_build_object(
      'categories', v_categories,
      'customer_types', jsonb_build_object(v_customer_type, 1),
      'payment_methods', jsonb_build_object(v_payment_method, 1)
    )
  )
  ON CONFLICT (date) DO UPDATE SET
    total_sales_amount = daily_analytics.total_sales_amount + v_amount,
    bills_generated_count = daily_analytics.bills_generated_count + 1,
    total_items_sold = daily_analytics.total_items_sold + COALESCE(v_items_count, 0),
    total_sales = daily_analytics.total_sales + 1,
    total_revenue = daily_analytics.total_revenue + v_amount,
    total_items = daily_analytics.total_items + COALESCE(v_items_count, 0),
    purchases = daily_analytics.purchases || jsonb_build_array(v_items_data),
    top_categories = jsonb_set(
      COALESCE(daily_analytics.top_categories, '{}'::jsonb),
      '{}'::text[],
      (
        SELECT jsonb_object_agg(category, total)
        FROM (
          SELECT category, SUM(quantity) as total
          FROM (
            SELECT 
              key as category,
              value::integer as quantity
            FROM jsonb_each_text(v_categories)
            UNION ALL
            SELECT 
              key as category,
              value::integer as quantity
            FROM jsonb_each_text(COALESCE(daily_analytics.top_categories, '{}'::jsonb))
          ) combined
          GROUP BY category
          ORDER BY total DESC
          LIMIT 10
        ) top_cats
      )
    ),
    monthly_trend = jsonb_set(
      COALESCE(daily_analytics.monthly_trend, '{}'::jsonb),
      array[v_month],
      jsonb_build_object(
        'sales', COALESCE((daily_analytics.monthly_trend->>v_month)::numeric, 0) + 1,
        'revenue', COALESCE((daily_analytics.monthly_trend->v_month->>'revenue')::numeric, 0) + v_amount,
        'items', COALESCE((daily_analytics.monthly_trend->v_month->>'items')::numeric, 0) + v_items_count
      )
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