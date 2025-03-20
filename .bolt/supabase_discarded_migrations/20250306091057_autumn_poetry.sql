/*
  # Daily Sales and Manufacturer Performance Tracking

  1. New Functions
    - update_daily_sales: Updates daily sales metrics
    - update_manufacturer_performance: Updates manufacturer performance metrics
    - track_completed_sale: Tracks completed sales

  2. Triggers
    - completed_sale_trigger: Triggers updates when sale is completed
    - daily_metrics_trigger: Updates daily metrics

  3. Tables
    - daily_sales: Stores daily sales metrics
    - manufacturer_performance: Stores manufacturer performance metrics
*/

-- Create daily sales table if not exists
CREATE TABLE IF NOT EXISTS daily_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  total_sales_amount numeric DEFAULT 0,
  total_items_sold integer DEFAULT 0,
  payment_collection numeric DEFAULT 0,
  bills_generated_count integer DEFAULT 0,
  stats jsonb DEFAULT '{
    "categories": {},
    "payment_methods": {},
    "customer_types": {"retail": 0, "wholesale": 0}
  }'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Function to update daily sales metrics
CREATE OR REPLACE FUNCTION update_daily_sales()
RETURNS TRIGGER AS $$
DECLARE
  v_date date;
  v_customer_type text;
  v_item record;
  v_payment record;
BEGIN
  -- Get sale date
  v_date := CURRENT_DATE;
  
  -- Get customer type
  SELECT type INTO v_customer_type
  FROM customers
  WHERE id = NEW.customer_id;
  
  v_customer_type := COALESCE(v_customer_type, 'retail');

  -- Update daily sales record
  INSERT INTO daily_sales (
    date,
    total_sales_amount,
    total_items_sold,
    payment_collection,
    bills_generated_count,
    stats
  ) VALUES (
    v_date,
    NEW.total_amount,
    (SELECT SUM((item->>'quantity')::int) FROM jsonb_array_elements(NEW.items) AS item),
    COALESCE((NEW.payment_details->>'paid_amount')::numeric, 0),
    1,
    jsonb_build_object(
      'categories', '{}',
      'payment_methods', jsonb_build_object(
        COALESCE(NEW.payment_details->>'method', 'cash'), 1
      ),
      'customer_types', jsonb_build_object(
        v_customer_type, 1
      )
    )
  )
  ON CONFLICT (date) DO UPDATE SET
    total_sales_amount = daily_sales.total_sales_amount + NEW.total_amount,
    total_items_sold = daily_sales.total_items_sold + 
      (SELECT SUM((item->>'quantity')::int) FROM jsonb_array_elements(NEW.items) AS item),
    payment_collection = daily_sales.payment_collection + 
      COALESCE((NEW.payment_details->>'paid_amount')::numeric, 0),
    bills_generated_count = daily_sales.bills_generated_count + 1,
    stats = jsonb_set(
      daily_sales.stats,
      '{customer_types}'::text[],
      jsonb_set(
        COALESCE(daily_sales.stats->'customer_types', '{}'::jsonb),
        array[v_customer_type],
        to_jsonb(COALESCE((daily_sales.stats->'customer_types'->v_customer_type)::int, 0) + 1)
      )
    ),
    updated_at = now();

  -- Update category stats
  FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    UPDATE daily_sales SET
      stats = jsonb_set(
        stats,
        array['categories', v_item->>'category'],
        to_jsonb(
          COALESCE((stats->'categories'->(v_item->>'category'))::int, 0) + 
          (v_item->>'quantity')::int
        )
      )
    WHERE date = v_date;
  END LOOP;

  -- Update payment method stats if payment was made
  FOR v_payment IN SELECT * FROM jsonb_array_elements(NEW.payment_details->'payments')
  LOOP
    UPDATE daily_sales SET
      stats = jsonb_set(
        stats,
        array['payment_methods', v_payment->>'method'],
        to_jsonb(
          COALESCE((stats->'payment_methods'->(v_payment->>'method'))::int, 0) + 1
        )
      )
    WHERE date = v_date;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update manufacturer performance
CREATE OR REPLACE FUNCTION update_manufacturer_performance()
RETURNS TRIGGER AS $$
DECLARE
  v_item record;
  v_manufacturer text;
  v_quantity integer;
  v_revenue numeric;
  v_month text;
BEGIN
  -- Process each item in the sale
  FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    v_manufacturer := v_item->>'manufacturer';
    v_quantity := (v_item->>'quantity')::integer;
    v_revenue := (v_item->>'price')::numeric * v_quantity;
    v_month := to_char(CURRENT_DATE, 'YYYY-MM');

    -- Update manufacturer performance
    INSERT INTO manufacturer_performance (
      manufacturer,
      total_sales,
      total_items,
      total_revenue,
      average_price,
      top_categories,
      monthly_trend
    ) VALUES (
      v_manufacturer,
      v_quantity,
      v_quantity,
      v_revenue,
      v_revenue / v_quantity,
      jsonb_build_object(v_item->>'category', v_quantity),
      jsonb_build_object(
        v_month,
        jsonb_build_object(
          'sales', v_quantity,
          'revenue', v_revenue
        )
      )
    )
    ON CONFLICT (manufacturer) DO UPDATE SET
      total_sales = manufacturer_performance.total_sales + v_quantity,
      total_items = manufacturer_performance.total_items + v_quantity,
      total_revenue = manufacturer_performance.total_revenue + v_revenue,
      average_price = (manufacturer_performance.total_revenue + v_revenue) / 
                     (manufacturer_performance.total_items + v_quantity),
      top_categories = jsonb_set(
        COALESCE(manufacturer_performance.top_categories, '{}'::jsonb),
        array[v_item->>'category'],
        to_jsonb(
          COALESCE((manufacturer_performance.top_categories->(v_item->>'category'))::int, 0) + 
          v_quantity
        )
      ),
      monthly_trend = jsonb_set(
        COALESCE(manufacturer_performance.monthly_trend, '{}'::jsonb),
        array[v_month],
        jsonb_build_object(
          'sales', 
          COALESCE((manufacturer_performance.monthly_trend->v_month->>'sales')::int, 0) + v_quantity,
          'revenue',
          COALESCE((manufacturer_performance.monthly_trend->v_month->>'revenue')::numeric, 0) + v_revenue
        )
      ),
      updated_at = now();
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for completed sales
DROP TRIGGER IF EXISTS completed_sale_trigger ON quotations;
CREATE TRIGGER completed_sale_trigger
  AFTER INSERT OR UPDATE ON quotations
  FOR EACH ROW
  WHEN (
    (NEW.status = 'accepted' AND NEW.payment_details->>'payment_status' = 'completed') OR
    (OLD.payment_details->>'payment_status' != 'completed' AND NEW.payment_details->>'payment_status' = 'completed')
  )
  EXECUTE FUNCTION update_daily_sales();

-- Create trigger for manufacturer performance
DROP TRIGGER IF EXISTS manufacturer_performance_trigger ON quotations;
CREATE TRIGGER manufacturer_performance_trigger
  AFTER INSERT OR UPDATE ON quotations
  FOR EACH ROW
  WHEN (
    (NEW.status = 'accepted' AND NEW.payment_details->>'payment_status' = 'completed') OR
    (OLD.payment_details->>'payment_status' != 'completed' AND NEW.payment_details->>'payment_status' = 'completed')
  )
  EXECUTE FUNCTION update_manufacturer_performance();