/*
  # Update Stock Function with Error Logging
  
  Updates product stock levels with comprehensive error logging
*/

CREATE OR REPLACE FUNCTION update_product_stock(
  p_product_id uuid,
  p_quantity integer,
  p_manufacturer text,
  p_category text,
  p_price numeric
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
    v_error_id := log_stock_error(
      p_product_id := p_product_id,
      p_error_code := 'PRODUCT_NOT_FOUND',
      p_error_message := 'Product not found',
      p_staff_id := v_staff_id,
      p_additional_context := jsonb_build_object(
        'manufacturer', p_manufacturer,
        'category', p_category
      )
    );
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  -- Validate quantity
  IF p_quantity IS NULL OR p_quantity = 0 THEN
    v_error_id := log_stock_error(
      p_product_id := p_product_id,
      p_error_code := 'INVALID_QUANTITY',
      p_error_message := 'Invalid quantity specified',
      p_current_stock := v_current_stock,
      p_requested_change := p_quantity,
      p_staff_id := v_staff_id
    );
    RAISE EXCEPTION 'Invalid quantity: %', p_quantity;
  END IF;

  -- Check if update would result in negative stock
  IF v_current_stock - p_quantity < 0 THEN
    v_error_id := log_stock_error(
      p_product_id := p_product_id,
      p_error_code := 'INSUFFICIENT_STOCK',
      p_error_message := 'Insufficient stock for requested quantity',
      p_current_stock := v_current_stock,
      p_requested_change := p_quantity,
      p_staff_id := v_staff_id,
      p_transaction_details := jsonb_build_object(
        'price', p_price,
        'total_value', p_price * p_quantity
      )
    );
    RAISE EXCEPTION 'Insufficient stock: current=%, requested=%', v_current_stock, p_quantity;
  END IF;

  -- Attempt stock update
  BEGIN
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
      staff_id
    ) VALUES (
      p_product_id,
      v_current_stock,
      v_current_stock - p_quantity,
      p_quantity,
      'decrease',
      'success',
      v_staff_id
    );

  EXCEPTION WHEN OTHERS THEN
    -- Log any other errors
    v_error_id := log_stock_error(
      p_product_id := p_product_id,
      p_error_code := SQLSTATE,
      p_error_message := SQLERRM,
      p_current_stock := v_current_stock,
      p_requested_change := p_quantity,
      p_staff_id := v_staff_id,
      p_transaction_details := jsonb_build_object(
        'price', p_price,
        'total_value', p_price * p_quantity
      ),
      p_stack_trace := format(
        'Error at: %s\nDetail: %s\nHint: %s\nContext: %s',
        pg_exception_context(),
        pg_exception_detail(),
        pg_exception_hint(),
        pg_exception_context()
      )
    );
    RAISE;
  END;

END;
$$;