/*
  # Add sales analytics triggers

  1. Functions
    - `update_manufacturer_analytics()` - Updates manufacturer performance metrics
    - `update_daily_sales_metrics()` - Updates daily sales dashboard metrics
    
  2. Triggers
    - Trigger on quotations table for sales analytics
    - Trigger on sales table for daily metrics

  3. Changes
    - Add real-time analytics updates for sales dashboard
    - Add manufacturer performance tracking
*/

-- Function to update manufacturer analytics
CREATE OR REPLACE FUNCTION update_manufacturer_analytics()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  manufacturer_name TEXT;
  item_quantity INTEGER;
  item_price NUMERIC;
  item_category TEXT;
  current_month TEXT;
BEGIN
  -- Only process accepted quotations
  IF NEW.status = 'accepted' THEN
    current_month := to_char(CURRENT_DATE, 'YYYY-MM');
    
    -- Process each item in the quotation
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
      manufacturer_name := (item.value->>'product'->>'manufacturer')::TEXT;
      item_quantity := (item.value->>'quantity')::INTEGER;
      item_price := (item.value->>'price')::NUMERIC;
      item_category := (item.value->>'product'->>'category')::TEXT;
      
      -- Update manufacturer analytics
      INSERT INTO manufacturer_analytics (
        manufacturer,
        month,
        total_sales,
        total_items,
        total_revenue,
        average_price,
        categories
      ) VALUES (
        manufacturer_name,
        current_month,
        item_quantity * item_price,
        item_quantity,
        item_quantity * item_price,
        item_price,
        jsonb_build_object(item_category, item_quantity)
      )
      ON CONFLICT (manufacturer, month) DO UPDATE SET
        total_sales = manufacturer_analytics.total_sales + EXCLUDED.total_sales,
        total_items = manufacturer_analytics.total_items + EXCLUDED.total_items,
        total_revenue = manufacturer_analytics.total_revenue + EXCLUDED.total_revenue,
        average_price = (manufacturer_analytics.total_revenue + EXCLUDED.total_revenue) / 
                       (manufacturer_analytics.total_items + EXCLUDED.total_items),
        categories = jsonb_set(
          COALESCE(manufacturer_analytics.categories, '{}'::jsonb),
          ARRAY[item_category],
          to_jsonb(
            COALESCE((manufacturer_analytics.categories->>item_category)::INTEGER, 0) + 
            item_quantity
          )
        );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update daily sales metrics
CREATE OR REPLACE FUNCTION update_daily_sales_metrics()
RETURNS TRIGGER AS $$
DECLARE
  today DATE := CURRENT_DATE;
  total_items INTEGER;
BEGIN
  -- Calculate total items
  SELECT COALESCE(SUM((item->>'quantity')::INTEGER), 0)
  INTO total_items
  FROM jsonb_array_elements(NEW.items) item;

  -- Update daily analytics
  INSERT INTO daily_analytics (
    date,
    total_sales_amount,
    total_items_sold,
    payment_collection,
    bills_generated_count,
    stats
  ) VALUES (
    today,
    NEW.total_amount,
    total_items,
    CASE 
      WHEN NEW.payment_details->>'payment_status' = 'completed' THEN NEW.total_amount
      WHEN NEW.payment_details->>'payment_status' = 'partial' THEN (NEW.payment_details->>'paid_amount')::NUMERIC
      ELSE 0
    END,
    1,
    jsonb_build_object(
      'categories', (
        SELECT jsonb_object_agg(
          item->>'category',
          (item->>'quantity')::INTEGER
        )
        FROM jsonb_array_elements(NEW.items) AS item
      ),
      'payment_methods', jsonb_build_object(
        COALESCE(NEW.payment_details->'payments'->0->>'method', 'cash'), 1
      ),
      'customer_types', jsonb_build_object(
        COALESCE(NEW.customer_type, 'retail'), 1
      )
    )
  )
  ON CONFLICT (date) DO UPDATE SET
    total_sales_amount = daily_analytics.total_sales_amount + EXCLUDED.total_sales_amount,
    total_items_sold = daily_analytics.total_items_sold + EXCLUDED.total_items_sold,
    payment_collection = daily_analytics.payment_collection + EXCLUDED.payment_collection,
    bills_generated_count = daily_analytics.bills_generated_count + 1,
    stats = jsonb_set(
      jsonb_set(
        jsonb_set(
          daily_analytics.stats,
          '{categories}',
          daily_analytics.stats->'categories' || EXCLUDED.stats->'categories'
        ),
        '{payment_methods}',
        daily_analytics.stats->'payment_methods' || EXCLUDED.stats->'payment_methods'
      ),
      '{customer_types}',
      daily_analytics.stats->'customer_types' || EXCLUDED.stats->'customer_types'
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS update_manufacturer_analytics_trigger ON quotations;
CREATE TRIGGER update_manufacturer_analytics_trigger
  AFTER INSERT OR UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION update_manufacturer_analytics();

DROP TRIGGER IF EXISTS update_daily_sales_metrics_trigger ON quotations;
CREATE TRIGGER update_daily_sales_metrics_trigger
  AFTER INSERT OR UPDATE ON quotations
  FOR EACH ROW
  WHEN (NEW.status = 'accepted')
  EXECUTE FUNCTION update_daily_sales_metrics();

-- Create manufacturer_analytics table if it doesn't exist
CREATE TABLE IF NOT EXISTS manufacturer_analytics (
  manufacturer TEXT,
  month TEXT,
  total_sales NUMERIC DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  average_price NUMERIC DEFAULT 0,
  categories JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (manufacturer, month)
);