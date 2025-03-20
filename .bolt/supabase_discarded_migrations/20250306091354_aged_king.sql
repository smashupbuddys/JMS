/*
  # Daily Sales Analytics

  1. New Tables
    - daily_analytics: Tracks daily sales metrics and performance
    - manufacturer_analytics: Tracks manufacturer-wise sales performance

  2. Features
    - Real-time sales tracking
    - Customer type segmentation (retail vs wholesale)
    - Payment method tracking
    - Category-wise sales analysis
    - Manufacturer performance metrics
*/

-- Create daily analytics table
CREATE TABLE IF NOT EXISTS daily_analytics (
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

-- Create manufacturer analytics table
CREATE TABLE IF NOT EXISTS manufacturer_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer text NOT NULL UNIQUE,
  total_sales numeric DEFAULT 0,
  total_items integer DEFAULT 0,
  total_revenue numeric DEFAULT 0,
  average_price numeric DEFAULT 0,
  top_categories jsonb DEFAULT '{}',
  monthly_trend jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Function to update daily analytics
CREATE OR REPLACE FUNCTION update_daily_analytics()
RETURNS TRIGGER AS $$
DECLARE
  v_date date;
  v_customer_type text;
  v_item record;
  v_payment record;
  v_is_completed boolean;
BEGIN
  -- Get sale date
  v_date := CURRENT_DATE;
  
  -- Get customer type
  SELECT type INTO v_customer_type
  FROM customers
  WHERE id = NEW.customer_id;
  
  v_customer_type := COALESCE(v_customer_type, 'retail');

  -- Check if sale is completed
  v_is_completed := NEW.status = 'accepted' AND 
                    (NEW.payment_details->>'payment_status' = 'completed');

  -- Only process completed sales
  IF NOT v_is_completed THEN
    RETURN NEW;
  END IF;

  -- Update daily analytics
  INSERT INTO daily_analytics (
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
    total_sales_amount = daily_analytics.total_sales_amount + NEW.total_amount,
    total_items_sold = daily_analytics.total_items_sold + 
      (SELECT SUM((item->>'quantity')::int) FROM jsonb_array_elements(NEW.items) AS item),
    payment_collection = daily_analytics.payment_collection + 
      COALESCE((NEW.payment_details->>'paid_amount')::numeric, 0),
    bills_generated_count = daily_analytics.bills_generated_count + 1,
    stats = jsonb_set(
      daily_analytics.stats,
      '{customer_types}'::text[],
      jsonb_set(
        COALESCE(daily_analytics.stats->'customer_types', '{}'::jsonb),
        array[v_customer_type],
        to_jsonb(COALESCE((daily_analytics.stats->'customer_types'->v_customer_type)::int, 0) + 1)
      )
    ),
    updated_at = now();

  -- Update category stats
  FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    UPDATE daily_analytics SET
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
    UPDATE daily_analytics SET
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

-- Function to update manufacturer analytics
CREATE OR REPLACE FUNCTION update_manufacturer_analytics()
RETURNS TRIGGER AS $$
DECLARE
  v_item record;
  v_manufacturer text;
  v_quantity integer;
  v_revenue numeric;
  v_month text;
  v_is_completed boolean;
BEGIN
  -- Check if sale is completed
  v_is_completed := NEW.status = 'accepted' AND 
                    (NEW.payment_details->>'payment_status' = 'completed');

  -- Only process completed sales
  IF NOT v_is_completed THEN
    RETURN NEW;
  END IF;

  -- Process each item in the sale
  FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    v_manufacturer := v_item->>'manufacturer';
    v_quantity := (v_item->>'quantity')::integer;
    v_revenue := (v_item->>'price')::numeric * v_quantity;
    v_month := to_char(CURRENT_DATE, 'YYYY-MM');

    -- Update manufacturer analytics
    INSERT INTO manufacturer_analytics (
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
      total_sales = manufacturer_analytics.total_sales + v_quantity,
      total_items = manufacturer_analytics.total_items + v_quantity,
      total_revenue = manufacturer_analytics.total_revenue + v_revenue,
      average_price = (manufacturer_analytics.total_revenue + v_revenue) / 
                     (manufacturer_analytics.total_items + v_quantity),
      top_categories = jsonb_set(
        COALESCE(manufacturer_analytics.top_categories, '{}'::jsonb),
        array[v_item->>'category'],
        to_jsonb(
          COALESCE((manufacturer_analytics.top_categories->(v_item->>'category'))::int, 0) + 
          v_quantity
        )
      ),
      monthly_trend = jsonb_set(
        COALESCE(manufacturer_analytics.monthly_trend, '{}'::jsonb),
        array[v_month],
        jsonb_build_object(
          'sales', 
          COALESCE((manufacturer_analytics.monthly_trend->v_month->>'sales')::int, 0) + v_quantity,
          'revenue',
          COALESCE((manufacturer_analytics.monthly_trend->v_month->>'revenue')::numeric, 0) + v_revenue
        )
      ),
      updated_at = now();
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS daily_analytics_trigger ON quotations;
CREATE TRIGGER daily_analytics_trigger
  AFTER INSERT OR UPDATE ON quotations
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND NEW.payment_details->>'payment_status' = 'completed')
  EXECUTE FUNCTION update_daily_analytics();

DROP TRIGGER IF EXISTS manufacturer_analytics_trigger ON quotations;
CREATE TRIGGER manufacturer_analytics_trigger
  AFTER INSERT OR UPDATE ON quotations
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND NEW.payment_details->>'payment_status' = 'completed')
  EXECUTE FUNCTION update_manufacturer_analytics();