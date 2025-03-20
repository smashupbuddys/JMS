-- Drop existing manufacturer_analytics table and functions
DROP TABLE IF EXISTS manufacturer_analytics CASCADE;

-- Create manufacturer_analytics table with correct structure
CREATE TABLE manufacturer_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer text NOT NULL,
  total_sales_value numeric NOT NULL DEFAULT 0,
  total_sales_count integer NOT NULL DEFAULT 0,
  total_items_sold integer NOT NULL DEFAULT 0,
  average_price numeric NOT NULL DEFAULT 0,
  last_sale_date timestamptz,
  sales_rank integer,
  month text,
  forecast_data jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create unique index on manufacturer and month
CREATE UNIQUE INDEX idx_manufacturer_analytics_unique ON manufacturer_analytics(manufacturer, month);

-- Enable RLS
ALTER TABLE manufacturer_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Staff can view manufacturer analytics"
  ON manufacturer_analytics
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can update manufacturer analytics"
  ON manufacturer_analytics
  FOR UPDATE
  TO authenticated
  USING (true);

-- Function to update manufacturer analytics
CREATE OR REPLACE FUNCTION update_manufacturer_analytics()
RETURNS trigger AS $$
DECLARE
  v_month text;
BEGIN
  -- Get the month in YYYY-MM format
  v_month := to_char(NEW.created_at, 'YYYY-MM');

  -- Update or insert manufacturer statistics
  INSERT INTO manufacturer_analytics (
    manufacturer,
    total_sales_value,
    total_sales_count,
    total_items_sold,
    average_price,
    last_sale_date,
    month
  ) VALUES (
    NEW.manufacturer,
    NEW.total_price,
    1,
    NEW.quantity,
    NEW.unit_price,
    NEW.created_at,
    v_month
  )
  ON CONFLICT (manufacturer, month) DO UPDATE SET
    total_sales_value = manufacturer_analytics.total_sales_value + NEW.total_price,
    total_sales_count = manufacturer_analytics.total_sales_count + 1,
    total_items_sold = manufacturer_analytics.total_items_sold + NEW.quantity,
    average_price = (manufacturer_analytics.total_sales_value + NEW.total_price) / 
                   (manufacturer_analytics.total_items_sold + NEW.quantity),
    last_sale_date = GREATEST(manufacturer_analytics.last_sale_date, NEW.created_at),
    updated_at = now();

  -- Update sales ranking for the month
  WITH ranked_manufacturers AS (
    SELECT 
      manufacturer,
      RANK() OVER (ORDER BY total_sales_value DESC) as new_rank
    FROM manufacturer_analytics
    WHERE month = v_month
  )
  UPDATE manufacturer_analytics ma
  SET sales_rank = rm.new_rank
  FROM ranked_manufacturers rm
  WHERE ma.manufacturer = rm.manufacturer
  AND ma.month = v_month;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for manufacturer analytics
DROP TRIGGER IF EXISTS update_manufacturer_analytics_trigger ON sale_items;
CREATE TRIGGER update_manufacturer_analytics_trigger
  AFTER INSERT ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION update_manufacturer_analytics();

-- Function to get manufacturer analytics by month
CREATE OR REPLACE FUNCTION get_manufacturer_analytics_by_month(p_month text)
RETURNS TABLE (
  manufacturer text,
  total_sales_value numeric,
  total_sales_count integer,
  total_items_sold integer,
  average_price numeric,
  last_sale_date timestamptz,
  sales_rank integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ma.manufacturer,
    ma.total_sales_value,
    ma.total_sales_count,
    ma.total_items_sold,
    ma.average_price,
    ma.last_sale_date,
    ma.sales_rank
  FROM manufacturer_analytics ma
  WHERE ma.month = p_month
  ORDER BY ma.total_sales_value DESC;
END;
$$ LANGUAGE plpgsql;