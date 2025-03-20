/*
  # Manufacturer Sales Performance Tracking

  1. New Functions
    - track_manufacturer_sales: Updates manufacturer analytics on sales
    - update_manufacturer_metrics: Updates aggregated metrics
    - calculate_manufacturer_performance: Calculates performance scores

  2. Triggers
    - manufacturer_sales_trigger: Tracks sales performance
    - manufacturer_metrics_trigger: Updates metrics daily

  3. Tables
    - manufacturer_performance: Stores performance metrics
    - manufacturer_sales_history: Tracks detailed sales history
*/

-- Create manufacturer performance table if not exists
CREATE TABLE IF NOT EXISTS manufacturer_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer text NOT NULL,
  total_sales numeric DEFAULT 0,
  total_items integer DEFAULT 0,
  total_revenue numeric DEFAULT 0,
  average_price numeric DEFAULT 0,
  performance_score numeric DEFAULT 0,
  target_achievement numeric DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(manufacturer)
);

-- Create manufacturer sales history table if not exists
CREATE TABLE IF NOT EXISTS manufacturer_sales_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer text NOT NULL,
  sale_date date NOT NULL,
  sale_type text NOT NULL,
  items_sold integer NOT NULL,
  revenue numeric NOT NULL,
  average_price numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Function to track manufacturer sales
CREATE OR REPLACE FUNCTION track_manufacturer_sales()
RETURNS TRIGGER AS $$
DECLARE
  v_sale_type text;
  v_customer_type text;
  v_item record;
  v_manufacturer text;
  v_quantity integer;
  v_price numeric;
  v_revenue numeric;
BEGIN
  -- Determine sale type
  IF NEW.video_call_id IS NOT NULL THEN
    v_sale_type := 'video_call';
  ELSE
    v_sale_type := 'counter';
  END IF;

  -- Get customer type
  SELECT type INTO v_customer_type
  FROM customers
  WHERE id = NEW.customer_id;

  v_customer_type := COALESCE(v_customer_type, 'retail');

  -- Process each item in the sale
  FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    v_manufacturer := v_item->>'manufacturer';
    v_quantity := (v_item->>'quantity')::integer;
    v_price := (v_item->>'price')::numeric;
    v_revenue := v_quantity * v_price;

    -- Insert into sales history
    INSERT INTO manufacturer_sales_history (
      manufacturer,
      sale_date,
      sale_type,
      items_sold,
      revenue,
      average_price
    ) VALUES (
      v_manufacturer,
      CURRENT_DATE,
      v_customer_type,
      v_quantity,
      v_revenue,
      v_price
    );

    -- Update manufacturer performance
    INSERT INTO manufacturer_performance (
      manufacturer,
      total_sales,
      total_items,
      total_revenue,
      average_price
    ) VALUES (
      v_manufacturer,
      v_quantity,
      v_quantity,
      v_revenue,
      v_price
    )
    ON CONFLICT (manufacturer) DO UPDATE SET
      total_sales = manufacturer_performance.total_sales + v_quantity,
      total_items = manufacturer_performance.total_items + v_quantity,
      total_revenue = manufacturer_performance.total_revenue + v_revenue,
      average_price = (manufacturer_performance.total_revenue + v_revenue) / 
                     (manufacturer_performance.total_items + v_quantity),
      last_updated = now();
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate manufacturer performance scores
CREATE OR REPLACE FUNCTION calculate_manufacturer_performance()
RETURNS void AS $$
DECLARE
  v_manufacturer record;
  v_monthly_target numeric;
  v_monthly_sales numeric;
  v_performance_score numeric;
BEGIN
  FOR v_manufacturer IN SELECT * FROM manufacturer_performance
  LOOP
    -- Calculate monthly sales
    SELECT COALESCE(SUM(revenue), 0) INTO v_monthly_sales
    FROM manufacturer_sales_history
    WHERE manufacturer = v_manufacturer.manufacturer
    AND sale_date >= date_trunc('month', CURRENT_DATE);

    -- Get monthly target (example calculation)
    v_monthly_target := 1000000; -- 10 lakhs default target

    -- Calculate performance metrics
    v_performance_score := CASE
      WHEN v_monthly_sales >= v_monthly_target THEN 100
      ELSE (v_monthly_sales / v_monthly_target * 100)
    END;

    -- Update performance record
    UPDATE manufacturer_performance SET
      performance_score = v_performance_score,
      target_achievement = (v_monthly_sales / v_monthly_target * 100),
      last_updated = now()
    WHERE manufacturer = v_manufacturer.manufacturer;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tracking sales
DROP TRIGGER IF EXISTS track_manufacturer_sales_trigger ON quotations;
CREATE TRIGGER track_manufacturer_sales_trigger
  AFTER INSERT ON quotations
  FOR EACH ROW
  WHEN (NEW.status = 'accepted')
  EXECUTE FUNCTION track_manufacturer_sales();

-- Create function to update daily metrics
CREATE OR REPLACE FUNCTION update_daily_manufacturer_metrics()
RETURNS void AS $$
BEGIN
  -- Calculate performance scores
  PERFORM calculate_manufacturer_performance();
  
  -- Update manufacturer analytics
  INSERT INTO manufacturer_analytics (
    manufacturer,
    month,
    sales_data
  )
  SELECT 
    manufacturer,
    date_trunc('month', CURRENT_DATE)::date as month,
    jsonb_build_object(
      'total_sales', SUM(items_sold),
      'total_revenue', SUM(revenue),
      'average_price', AVG(average_price),
      'retail_sales', SUM(CASE WHEN sale_type = 'retail' THEN revenue ELSE 0 END),
      'wholesale_sales', SUM(CASE WHEN sale_type = 'wholesale' THEN revenue ELSE 0 END)
    ) as sales_data
  FROM manufacturer_sales_history
  WHERE sale_date >= date_trunc('month', CURRENT_DATE)
  GROUP BY manufacturer
  ON CONFLICT (manufacturer, month) DO UPDATE SET
    sales_data = EXCLUDED.sales_data,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Schedule daily metrics update (requires pg_cron extension)
-- SELECT cron.schedule('update_manufacturer_metrics', '0 0 * * *', 'SELECT update_daily_manufacturer_metrics()');