/*
  # Add stock update function with full parameters
  
  1. New Functions
    - `update_product_stock`: Updates product stock level with additional tracking info
      - Handles stock level updates atomically
      - Prevents stock from going negative
      - Updates last sold date
      - Tracks manufacturer and category stats
      
  2. Security
    - Function accessible to authenticated users only
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS update_product_stock(uuid, integer, timestamptz);
DROP FUNCTION IF EXISTS update_product_stock(uuid, integer, text, text, numeric);

-- Create function with full parameter set
CREATE OR REPLACE FUNCTION update_product_stock(
  p_product_id uuid,
  p_quantity integer,
  p_manufacturer text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_price numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update stock level and last sold date
  UPDATE products 
  SET 
    stock_level = stock_level - p_quantity,
    last_sold_at = CURRENT_TIMESTAMP
  WHERE 
    id = p_product_id 
    AND stock_level >= p_quantity;

  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock or product not found';
  END IF;

  -- Update manufacturer stats if provided
  IF p_manufacturer IS NOT NULL AND p_category IS NOT NULL AND p_price IS NOT NULL THEN
    INSERT INTO manufacturer_stats (
      manufacturer,
      category,
      total_sales,
      items_sold,
      last_sale_date
    ) VALUES (
      p_manufacturer,
      p_category,
      p_price * p_quantity,
      p_quantity,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (manufacturer, category) DO UPDATE
    SET
      total_sales = manufacturer_stats.total_sales + EXCLUDED.total_sales,
      items_sold = manufacturer_stats.items_sold + EXCLUDED.items_sold,
      last_sale_date = EXCLUDED.last_sale_date;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_product_stock TO authenticated;