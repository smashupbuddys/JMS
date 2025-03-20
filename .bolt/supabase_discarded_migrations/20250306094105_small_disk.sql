/*
  # Add stock update function
  
  1. New Functions
    - `update_product_stock`: Updates product stock level and last sold date
      - Handles stock level updates atomically
      - Prevents stock from going negative
      - Updates last sold date
      
  2. Security
    - Function accessible to authenticated users only
*/

-- Create function to update product stock
CREATE OR REPLACE FUNCTION update_product_stock(
  p_product_id uuid,
  p_quantity integer,
  p_last_sold timestamptz
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
    last_sold_at = p_last_sold
  WHERE 
    id = p_product_id 
    AND stock_level >= p_quantity;

  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock or product not found';
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_product_stock TO authenticated;