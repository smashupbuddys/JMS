/*
  # Add stock update function
  
  1. New Functions
    - `update_product_stock`: Updates product stock levels and tracks sales history
      - Decrements stock level by specified quantity
      - Updates last sold date
      - Records sale in product history
      - Handles manufacturer and category analytics
      
  2. Parameters
    - p_product_id: Product ID to update
    - p_quantity: Quantity sold
    - p_manufacturer: Manufacturer name
    - p_category: Product category
    - p_price: Sale price
*/

CREATE OR REPLACE FUNCTION update_product_stock(
  p_product_id uuid,
  p_quantity integer,
  p_manufacturer text,
  p_category text, 
  p_price numeric
) RETURNS void AS $$
BEGIN
  -- Validate inputs
  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'Product ID cannot be null';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than 0';
  END IF;

  -- Update product stock level and last sold date
  UPDATE products 
  SET 
    stock_level = GREATEST(0, stock_level - p_quantity),
    last_sold_at = CURRENT_TIMESTAMP,
    sales_history = COALESCE(sales_history, '[]'::jsonb) || jsonb_build_object(
      'date', CURRENT_TIMESTAMP,
      'quantity', p_quantity,
      'price', p_price,
      'manufacturer', p_manufacturer,
      'category', p_category
    )
  WHERE id = p_product_id;

  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  -- Update manufacturer analytics
  INSERT INTO manufacturer_analytics (
    manufacturer,
    category,
    total_quantity,
    total_amount,
    last_sale_date
  ) VALUES (
    p_manufacturer,
    p_category,
    p_quantity,
    p_price * p_quantity,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (manufacturer, category) 
  DO UPDATE SET
    total_quantity = manufacturer_analytics.total_quantity + EXCLUDED.total_quantity,
    total_amount = manufacturer_analytics.total_amount + EXCLUDED.total_amount,
    last_sale_date = EXCLUDED.last_sale_date;

END;
$$ LANGUAGE plpgsql;