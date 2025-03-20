/*
  # Add daily analytics tracking

  1. New Tables
    - `daily_analytics` - Stores daily sales metrics and statistics
      - date (primary key)
      - video_calls_count
      - bills_generated_count
      - total_sales_amount
      - total_items_sold
      - new_customers_count
      - payment_collection
      - stats (JSONB for category/payment breakdowns)

  2. Functions
    - `update_daily_analytics()` - Updates analytics when sales occur
    - `calculate_daily_metrics()` - Calculates metrics for current day

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
    "customer_types": {"retail": 0, "wholesale": 0}
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

-- Function to calculate daily metrics
CREATE OR REPLACE FUNCTION calculate_daily_metrics(p_date date DEFAULT CURRENT_DATE)
RETURNS void AS $$
DECLARE
  v_stats jsonb;
BEGIN
  -- Calculate category stats
  WITH category_stats AS (
    SELECT 
      p.category,
      COUNT(*) as count,
      SUM(q.total_amount) as amount
    FROM quotations q
    CROSS JOIN LATERAL jsonb_array_elements(q.items) as i
    CROSS JOIN LATERAL jsonb_to_record(i) as p(category text)
    WHERE DATE(q.created_at) = p_date
    AND q.status = 'accepted'
    GROUP BY p.category
  )
  SELECT 
    jsonb_object_agg(
      category,
      jsonb_build_object(
        'count', count,
        'amount', amount
      )
    )
  INTO v_stats
  FROM category_stats;

  -- Insert or update daily analytics
  INSERT INTO daily_analytics (
    date,
    video_calls_count,
    bills_generated_count,
    total_sales_amount,
    total_items_sold,
    new_customers_count,
    payment_collection,
    stats
  )
  SELECT
    p_date,
    COUNT(DISTINCT CASE WHEN vc.status = 'completed' THEN vc.id END),
    COUNT(DISTINCT q.id),
    COALESCE(SUM(q.total_amount), 0),
    COALESCE(SUM((SELECT SUM((i->>'quantity')::int) FROM jsonb_array_elements(q.items) i)), 0),
    COUNT(DISTINCT CASE WHEN DATE(c.created_at) = p_date THEN c.id END),
    COALESCE(SUM(CASE 
      WHEN q.payment_details->>'payment_status' = 'completed' THEN q.total_amount
      WHEN q.payment_details->>'payment_status' = 'partial' THEN (q.payment_details->>'paid_amount')::numeric
      ELSE 0
    END), 0),
    jsonb_build_object(
      'categories', COALESCE(v_stats, '{}'::jsonb),
      'payment_methods', (
        SELECT jsonb_object_agg(
          payment_method,
          COUNT(*)
        )
        FROM quotations q2,
        jsonb_array_elements(q2.payment_details->'payments') as p
        CROSS JOIN LATERAL jsonb_to_record(p) as pm(payment_method text)
        WHERE DATE(q2.created_at) = p_date
      ),
      'customer_types', jsonb_build_object(
        'retail', COUNT(DISTINCT CASE WHEN c.type = 'retailer' THEN q.id END),
        'wholesale', COUNT(DISTINCT CASE WHEN c.type = 'wholesaler' THEN q.id END)
      )
    )
  FROM quotations q
  LEFT JOIN video_calls vc ON q.video_call_id = vc.id
  LEFT JOIN customers c ON q.customer_id = c.id
  WHERE DATE(q.created_at) = p_date
  AND q.status = 'accepted'
  ON CONFLICT (date) DO UPDATE SET
    video_calls_count = EXCLUDED.video_calls_count,
    bills_generated_count = EXCLUDED.bills_generated_count,
    total_sales_amount = EXCLUDED.total_sales_amount,
    total_items_sold = EXCLUDED.total_items_sold,
    new_customers_count = EXCLUDED.new_customers_count,
    payment_collection = EXCLUDED.payment_collection,
    stats = EXCLUDED.stats;
END;
$$ LANGUAGE plpgsql;

-- Function to update analytics when a sale occurs
CREATE OR REPLACE FUNCTION update_daily_analytics()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update for accepted quotations
  IF NEW.status = 'accepted' THEN
    PERFORM calculate_daily_metrics(DATE(NEW.created_at));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for quotations
CREATE TRIGGER update_daily_analytics_on_quotation
  AFTER INSERT OR UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_analytics();

-- Initialize today's metrics
SELECT calculate_daily_metrics();