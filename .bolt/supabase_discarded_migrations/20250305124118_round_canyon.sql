-- Add month column to manufacturer_analytics
ALTER TABLE manufacturer_analytics
ADD COLUMN month text;

-- Create index on month column
CREATE INDEX idx_manufacturer_analytics_month ON manufacturer_analytics(month);

-- Update update_manufacturer_analytics function to include month
CREATE OR REPLACE FUNCTION update_manufacturer_analytics()
RETURNS trigger AS $$
BEGIN
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
    to_char(NEW.created_at, 'YYYY-MM')
  )
  ON CONFLICT (manufacturer) DO UPDATE SET
    total_sales_value = manufacturer_analytics.total_sales_value + NEW.total_price,
    total_sales_count = manufacturer_analytics.total_sales_count + 1,
    total_items_sold = manufacturer_analytics.total_items_sold + NEW.quantity,
    average_price = (manufacturer_analytics.total_sales_value + NEW.total_price) / 
                   (manufacturer_analytics.total_items_sold + NEW.quantity),
    last_sale_date = NEW.created_at,
    month = to_char(NEW.created_at, 'YYYY-MM'),
    updated_at = now();

  -- Update sales ranking
  WITH ranked_manufacturers AS (
    SELECT 
      manufacturer,
      RANK() OVER (ORDER BY total_sales_value DESC) as new_rank
    FROM manufacturer_analytics
  )
  UPDATE manufacturer_analytics ma
  SET sales_rank = rm.new_rank
  FROM ranked_manufacturers rm
  WHERE ma.manufacturer = rm.manufacturer;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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