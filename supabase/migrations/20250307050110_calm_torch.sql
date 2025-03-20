/*
  # Fix Stock Management Type Error

  1. Changes
    - Drop existing function
    - Create updated function with proper type handling
    - Fix timestamp comparison issue

  2. Security
    - Maintains existing security policies
    - Keeps SECURITY DEFINER setting
*/

-- Drop existing function to avoid conflicts
DROP FUNCTION IF EXISTS update_product_stock(uuid, integer, text, text, numeric);

-- Create updated function with proper type handling
CREATE OR REPLACE FUNCTION update_product_stock(
  p_product_id uuid,
  p_quantity integer,
  p_manufacturer text,
  p_category text,
  p_price numeric
) RETURNS jsonb AS $$
DECLARE
  v_current_stock integer;
  v_new_stock integer;
  v_product_name text;
  v_result jsonb;
  v_current_month date;
BEGIN
  -- Get current month for analytics
  v_current_month := date_trunc('month', current_date);

  -- Get current product details
  SELECT stock_level, name 
  INTO v_current_stock, v_product_name
  FROM products 
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    PERFORM log_stock_error(
      p_product_id,
      p_quantity,
      0,
      'Product not found',
      'PRODUCT_NOT_FOUND'
    );
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Product not found',
      'code', 'PRODUCT_NOT_FOUND'
    );
  END IF;

  -- Calculate new stock level
  v_new_stock := v_current_stock - p_quantity;

  -- Validate stock level
  IF v_new_stock < 0 THEN
    PERFORM log_stock_error(
      p_product_id,
      p_quantity,
      v_current_stock,
      'Insufficient stock',
      'INSUFFICIENT_STOCK',
      jsonb_build_object(
        'requested', p_quantity,
        'available', v_current_stock
      )
    );
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient stock',
      'code', 'INSUFFICIENT_STOCK',
      'details', jsonb_build_object(
        'requested', p_quantity,
        'available', v_current_stock
      )
    );
  END IF;

  -- Update stock
  UPDATE products SET
    stock_level = v_new_stock,
    last_sold_at = CASE 
      WHEN p_quantity > 0 THEN now()
      ELSE last_sold_at
    END
  WHERE id = p_product_id;

  -- Track history
  PERFORM track_stock_history(
    p_product_id,
    v_current_stock,
    v_new_stock,
    'sale'
  );

  -- Update manufacturer analytics using proper date comparison
  UPDATE manufacturer_analytics SET
    total_sales = total_sales + (p_price * p_quantity),
    total_items = total_items + p_quantity,
    updated_at = now()
  WHERE manufacturer = p_manufacturer
  AND month::date = v_current_month;

  -- If no row was updated, insert new analytics
  IF NOT FOUND THEN
    INSERT INTO manufacturer_analytics (
      manufacturer,
      month,
      total_sales,
      total_items
    ) VALUES (
      p_manufacturer,
      v_current_month,
      p_price * p_quantity,
      p_quantity
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'previous_stock', v_current_stock,
    'new_stock', v_new_stock,
    'change', -p_quantity,
    'updated_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;