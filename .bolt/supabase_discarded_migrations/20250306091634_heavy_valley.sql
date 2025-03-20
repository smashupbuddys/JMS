/*
  # Analytics Tables and Functions

  1. New Tables
    - daily_analytics: Tracks daily sales metrics
    - manufacturer_analytics: Tracks manufacturer performance
    - sales_analytics: Tracks detailed sales data

  2. Features
    - Real-time sales tracking
    - Customer type segmentation
    - Payment method tracking
    - Category-wise analysis
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

-- Create sales analytics table
CREATE TABLE IF NOT EXISTS sales_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_date date NOT NULL,
  sale_type text NOT NULL,
  customer_type text NOT NULL,
  payment_method text NOT NULL,
  total_amount numeric NOT NULL,
  items_count integer NOT NULL,
  manufacturer text NOT NULL,
  category text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Function to update analytics on sale completion
CREATE OR REPLACE FUNCTION update_analytics_on_sale()
RETURNS TRIGGER AS $$
DECLARE
  v_date date;
  v_customer_type text;
  v_item record;
  v_payment record;
BEGIN
  -- Get sale date and customer type
  v_date := CURRENT_DATE;
  SELECT type INTO v_customer_type
  FROM customers
  WHERE id = NEW.customer_id;
  
  v_customer_type := COALESCE(v_customer_type, 'retail');

  -- Only process completed sales
  IF NEW.status = 'accepted' AND NEW.payment_details->>'payment_status' = 'completed' THEN
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

    -- Update manufacturer analytics
    FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      -- Insert sales analytics record
      INSERT INTO sales_analytics (
        sale_date,
        sale_type,
        customer_type,
        payment_method,
        total_amount,
        items_count,
        manufacturer,
        category
      ) VALUES (
        v_date,
        CASE WHEN NEW.video_call_id IS NOT NULL THEN 'video_call' ELSE 'counter' END,
        v_customer_type,
        COALESCE(NEW.payment_details->>'method', 'cash'),
        (v_item->>'price')::numeric * (v_item->>'quantity')::integer,
        (v_item->>'quantity')::integer,
        v_item->>'manufacturer',
        v_item->>'category'
      );

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
        v_item->>'manufacturer',
        (v_item->>'quantity')::integer,
        (v_item->>'quantity')::integer,
        (v_item->>'price')::numeric * (v_item->>'quantity')::integer,
        (v_item->>'price')::numeric,
        jsonb_build_object(v_item->>'category', (v_item->>'quantity')::integer),
        jsonb_build_object(
          to_char(CURRENT_DATE, 'YYYY-MM'),
          jsonb_build_object(
            'sales', (v_item->>'quantity')::integer,
            'revenue', (v_item->>'price')::numeric * (v_item->>'quantity')::integer
          )
        )
      )
      ON CONFLICT (manufacturer) DO UPDATE SET
        total_sales = manufacturer_analytics.total_sales + (v_item->>'quantity')::integer,
        total_items = manufacturer_analytics.total_items + (v_item->>'quantity')::integer,
        total_revenue = manufacturer_analytics.total_revenue + 
          ((v_item->>'price')::numeric * (v_item->>'quantity')::integer),
        average_price = (manufacturer_analytics.total_revenue + 
          ((v_item->>'price')::numeric * (v_item->>'quantity')::integer)) / 
          (manufacturer_analytics.total_items + (v_item->>'quantity')::integer),
        top_categories = jsonb_set(
          COALESCE(manufacturer_analytics.top_categories, '{}'::jsonb),
          array[v_item->>'category'],
          to_jsonb(
            COALESCE((manufacturer_analytics.top_categories->(v_item->>'category'))::int, 0) + 
            (v_item->>'quantity')::integer
          )
        ),
        monthly_trend = jsonb_set(
          COALESCE(manufacturer_analytics.monthly_trend, '{}'::jsonb),
          array[to_char(CURRENT_DATE, 'YYYY-MM')],
          jsonb_build_object(
            'sales', 
            COALESCE((manufacturer_analytics.monthly_trend->to_char(CURRENT_DATE, 'YYYY-MM')->>'sales')::int, 0) + 
            (v_item->>'quantity')::integer,
            'revenue',
            COALESCE((manufacturer_analytics.monthly_trend->to_char(CURRENT_DATE, 'YYYY-MM')->>'revenue')::numeric, 0) + 
            ((v_item->>'price')::numeric * (v_item->>'quantity')::integer)
          )
        ),
        updated_at = now();
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for analytics updates
DROP TRIGGER IF EXISTS update_analytics_trigger ON quotations;
CREATE TRIGGER update_analytics_trigger
  AFTER INSERT OR UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION update_analytics_on_sale();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_daily_analytics_date ON daily_analytics(date);
CREATE INDEX IF NOT EXISTS idx_manufacturer_analytics_manufacturer ON manufacturer_analytics(manufacturer);
CREATE INDEX IF NOT EXISTS idx_sales_analytics_sale_date ON sales_analytics(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_analytics_customer_type ON sales_analytics(customer_type);
CREATE INDEX IF NOT EXISTS idx_sales_analytics_manufacturer ON sales_analytics(manufacturer);
CREATE INDEX IF NOT EXISTS idx_sales_analytics_category ON sales_analytics(category);