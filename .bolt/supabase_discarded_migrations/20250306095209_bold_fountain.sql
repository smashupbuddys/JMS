/*
  # Update Stock Function V2
  
  1. Changes
    - Drop existing function
    - Recreate with proper parameter defaults
    - Add better error handling and validation
    
  2. Parameters
    - p_product_id: Product ID
    - p_quantity: Quantity to update
    - p_manufacturer: Manufacturer name
    - p_category: Category name
    - p_price: Price per unit
*/

-- First drop the existing function
DROP FUNCTION IF EXISTS update_product_stock(uuid, integer, text, text, numeric);

-- Recreate the function with proper parameter defaults
CREATE OR REPLACE FUNCTION update_product_stock(
  p_product_id uuid,
  p_quantity integer,
  p_manufacturer text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_price numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_stock integer;
  v_error_id uuid;
  v_staff_id uuid;
BEGIN
  -- Get current staff ID
  v_staff_id := auth.uid();

  -- Get current stock level
  SELECT stock_level INTO v_current_stock
  FROM products
  WHERE id = p_product_id;

  -- Validate product exists
  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id
    USING ERRCODE = 'P0002';
  END IF;

  -- Validate quantity
  IF p_quantity IS NULL OR p_quantity = 0 THEN
    RAISE EXCEPTION 'Invalid quantity specified: %', p_quantity
    USING ERRCODE = 'P0001';
  END IF;

  -- Check if update would result in negative stock
  IF v_current_stock - p_quantity < 0 THEN
    RAISE EXCEPTION 'Insufficient stock: current=%, requested=%', v_current_stock, p_quantity
    USING ERRCODE = 'P0003';
  END IF;

  -- Attempt stock update
  UPDATE products
  SET 
    stock_level = stock_level - p_quantity,
    last_stock_update = now(),
    updated_at = now()
  WHERE id = p_product_id;

  -- Log successful update
  INSERT INTO stock_update_history (
    product_id,
    previous_stock,
    new_stock,
    change_amount,
    change_type,
    status,
    staff_id,
    transaction_details
  ) VALUES (
    p_product_id,
    v_current_stock,
    v_current_stock - p_quantity,
    p_quantity,
    'decrease',
    'success',
    v_staff_id,
    jsonb_build_object(
      'manufacturer', p_manufacturer,
      'category', p_category,
      'price', p_price,
      'total_value', p_price * p_quantity
    )
  );

EXCEPTION WHEN OTHERS THEN
  -- Log error details
  INSERT INTO stock_update_errors (
    product_id,
    error_code,
    error_message,
    current_stock,
    requested_change,
    staff_id,
    transaction_details,
    stack_trace
  ) VALUES (
    p_product_id,
    SQLSTATE,
    SQLERRM,
    v_current_stock,
    p_quantity,
    v_staff_id,
    jsonb_build_object(
      'manufacturer', p_manufacturer,
      'category', p_category,
      'price', p_price,
      'total_value', p_price * p_quantity
    ),
    format(
      'Error at: %s\nDetail: %s\nHint: %s\nContext: %s',
      pg_exception_context(),
      pg_exception_detail(),
      pg_exception_hint(),
      pg_exception_context()
    )
  );
  RAISE;
END;
$$;