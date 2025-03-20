/*
  # Stock Update Function Migration
  
  1. Changes
    - Drop existing function
    - Create new function with proper parameter handling
    - Add error logging and validation
    - Add transaction history tracking
    
  2. Tables
    - Creates stock_update_history table
    - Creates stock_update_errors table
    
  3. Function Parameters
    - p_product_id: Product ID (uuid)
    - p_quantity: Quantity to update (integer)
    - p_manufacturer: Manufacturer name (text, optional)
    - p_category: Category name (text, optional)
    - p_price: Price per unit (numeric, optional)
*/

-- Create history table if not exists
CREATE TABLE IF NOT EXISTS stock_update_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  previous_stock integer,
  new_stock integer,
  change_amount integer,
  change_type text,
  status text,
  staff_id uuid,
  transaction_details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create errors table if not exists
CREATE TABLE IF NOT EXISTS stock_update_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  error_code text,
  error_message text,
  current_stock integer,
  requested_change integer,
  staff_id uuid,
  transaction_details jsonb,
  stack_trace text,
  created_at timestamptz DEFAULT now()
);

-- Drop existing function if exists
DROP FUNCTION IF EXISTS update_product_stock(uuid, integer, text, text, numeric);

-- Create new function with proper parameter handling
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