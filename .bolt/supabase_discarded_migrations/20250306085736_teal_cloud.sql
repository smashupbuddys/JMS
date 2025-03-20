/*
  # Create daily analytics table and functions

  1. New Tables
    - `daily_analytics`
      - `date` (date, primary key)
      - `video_calls_count` (integer)
      - `bills_generated_count` (integer) 
      - `total_sales_amount` (numeric)
      - `total_items_sold` (integer)
      - `new_customers_count` (integer)
      - `payment_collection` (numeric)
      - `stats` (jsonb)

  2. Functions
    - `update_daily_analytics()` - Updates analytics for current day
    - `get_daily_analytics()` - Gets analytics for specified date range

  3. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create daily analytics table
CREATE TABLE IF NOT EXISTS daily_analytics (
  date date PRIMARY KEY,
  video_calls_count integer DEFAULT 0,
  bills_generated_count integer DEFAULT 0,
  total_sales_amount numeric DEFAULT 0,
  total_items_sold integer DEFAULT 0,
  new_customers_count integer DEFAULT 0,
  payment_collection numeric DEFAULT 0,
  stats jsonb DEFAULT '{
    "categories": {},
    "payment_methods": {},
    "customer_types": {
      "retail": 0,
      "wholesale": 0
    }
  }'::jsonb
);

-- Enable RLS
ALTER TABLE daily_analytics ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to view daily analytics"
  ON daily_analytics
  FOR SELECT
  TO authenticated
  USING (true);

-- Function to update daily analytics
CREATE OR REPLACE FUNCTION update_daily_analytics()
RETURNS TRIGGER AS $$
DECLARE
  current_date_stats jsonb;
  category_stats jsonb;
  payment_stats jsonb;
  customer_type_stats jsonb;
  total_items integer;
BEGIN
  -- Get or create today's stats
  INSERT INTO daily_analytics (date)
  VALUES (CURRENT_DATE)
  ON CONFLICT (date) DO NOTHING;

  -- Calculate total items
  total_items := (
    SELECT COALESCE(SUM((jsonb_array_elements(NEW.items)->>'quantity')::integer), 0)
    FROM jsonb_array_elements(NEW.items)
  );

  -- Update daily totals
  UPDATE daily_analytics
  SET
    bills_generated_count = bills_generated_count + 1,
    total_sales_amount = total_sales_amount + NEW.total_amount,
    total_items_sold = total_items_sold + total_items,
    payment_collection = payment_collection + COALESCE((NEW.payment_details->>'paid_amount')::numeric, 0)
  WHERE date = CURRENT_DATE;

  -- Update category stats
  WITH category_counts AS (
    SELECT 
      item->>'category' as category,
      SUM((item->>'quantity')::integer) as quantity,
      SUM((item->>'price')::numeric * (item->>'quantity')::integer) as revenue
    FROM jsonb_array_elements(NEW.items) as item
    GROUP BY item->>'category'
  )
  UPDATE daily_analytics
  SET stats = jsonb_set(
    stats,
    '{categories}',
    COALESCE(stats->'categories', '{}'::jsonb) || 
    (
      SELECT jsonb_object_agg(
        category,
        jsonb_build_object(
          'quantity', COALESCE((stats->'categories'->category->>'quantity')::integer, 0) + quantity,
          'revenue', COALESCE((stats->'categories'->category->>'revenue')::numeric, 0) + revenue
        )
      )
      FROM category_counts
    )
  )
  WHERE date = CURRENT_DATE;

  -- Update payment method stats
  UPDATE daily_analytics
  SET stats = jsonb_set(
    stats,
    '{payment_methods}',
    COALESCE(stats->'payment_methods', '{}'::jsonb) || 
    jsonb_build_object(
      NEW.payment_details->>'method',
      COALESCE((stats->'payment_methods'->(NEW.payment_details->>'method'))::integer, 0) + 1
    )
  )
  WHERE date = CURRENT_DATE;

  -- Update customer type stats
  UPDATE daily_analytics
  SET stats = jsonb_set(
    stats,
    '{customer_types}',
    jsonb_build_object(
      'retail', CASE 
        WHEN NEW.customer_type = 'retailer' 
        THEN COALESCE((stats->'customer_types'->>'retail')::integer, 0) + 1
        ELSE COALESCE((stats->'customer_types'->>'retail')::integer, 0)
      END,
      'wholesale', CASE 
        WHEN NEW.customer_type = 'wholesaler'
        THEN COALESCE((stats->'customer_types'->>'wholesale')::integer, 0) + 1
        ELSE COALESCE((stats->'customer_types'->>'wholesale')::integer, 0)
      END
    )
  )
  WHERE date = CURRENT_DATE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for quotations
CREATE TRIGGER update_daily_analytics_on_quotation
  AFTER INSERT ON quotations
  FOR EACH ROW
  WHEN (NEW.status = 'accepted')
  EXECUTE FUNCTION update_daily_analytics();

-- Function to get daily analytics
CREATE OR REPLACE FUNCTION get_daily_analytics(
  p_start_date date,
  p_end_date date
)
RETURNS SETOF daily_analytics AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM daily_analytics
  WHERE date BETWEEN p_start_date AND p_end_date
  ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql;