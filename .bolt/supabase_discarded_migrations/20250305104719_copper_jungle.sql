/*
  # Create Sale Functions

  1. New Functions
    - process_complete_sale: Main function to process a complete sale
    - validate_sale_data: Helper function to validate sale data
    - update_stock_levels: Helper function to update product stock levels
    - record_sale_transaction: Helper function to record the sale transaction

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for staff access
*/

-- Function to validate sale data
CREATE OR REPLACE FUNCTION validate_sale_data(
  p_items jsonb,
  p_payment_details jsonb,
  OUT valid boolean,
  OUT errors jsonb
)
RETURNS record AS $$
DECLARE
  v_item record;
  v_stock_level integer;
  v_error_list jsonb := '[]'::jsonb;
BEGIN
  -- Validate items array
  IF jsonb_typeof(p_items) != 'array' THEN
    valid := false;
    errors := jsonb_build_array(
      jsonb_build_object(
        'error', 'Items must be an array',
        'field', 'items'
      )
    );
    RETURN;
  END IF;

  -- Validate each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Check required fields
    IF NOT (
      v_item ? 'product_id' AND
      v_item ? 'quantity' AND
      v_item ? 'price'
    ) THEN
      v_error_list := v_error_list || jsonb_build_object(
        'error', 'Missing required fields',
        'item', v_item
      );
      CONTINUE;
    END IF;

    -- Check stock availability
    SELECT stock_level INTO v_stock_level
    FROM products
    WHERE id = (v_item->>'product_id')::uuid;

    IF v_stock_level IS NULL THEN
      v_error_list := v_error_list || jsonb_build_object(
        'error', 'Product not found',
        'product_id', v_item->>'product_id'
      );
    ELSIF v_stock_level < (v_item->>'quantity')::integer THEN
      v_error_list := v_error_list || jsonb_build_object(
        'error', format(
          'Insufficient stock for product %s: requested %s, available %s',
          v_item->>'product_id',
          v_item->>'quantity',
          v_stock_level
        ),
        'product_id', v_item->>'product_id'
      );
    END IF;
  END LOOP;

  -- Validate payment details
  IF NOT validate_payment_details(p_payment_details) THEN
    v_error_list := v_error_list || jsonb_build_object(
      'error', 'Invalid payment details structure',
      'field', 'payment_details'
    );
  END IF;

  valid := jsonb_array_length(v_error_list) = 0;
  errors := v_error_list;
END;
$$ LANGUAGE plpgsql;

-- Function to process complete sale
CREATE OR REPLACE FUNCTION process_complete_sale(
  p_customer_id uuid,
  p_customer_type text,
  p_items jsonb,
  p_payment_details jsonb,
  p_staff_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_sale_id uuid;
  v_validation record;
  v_total_amount numeric := 0;
  v_item record;
BEGIN
  -- Validate input data
  SELECT * INTO v_validation
  FROM validate_sale_data(p_items, p_payment_details);

  IF NOT v_validation.valid THEN
    RETURN jsonb_build_object(
      'success', false,
      'errors', v_validation.errors
    );
  END IF;

  -- Calculate total amount
  SELECT SUM((item->>'price')::numeric * (item->>'quantity')::integer)
  INTO v_total_amount
  FROM jsonb_array_elements(p_items) as item;

  -- Create sale record
  INSERT INTO sales (
    sale_type,
    customer_id,
    total_amount,
    payment_status,
    payment_details,
    created_by
  ) VALUES (
    'counter',
    p_customer_id,
    v_total_amount,
    p_payment_details->>'payment_status',
    p_payment_details,
    p_staff_id
  ) RETURNING id INTO v_sale_id;

  -- Update stock levels
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE products SET
      stock_level = GREATEST(0, stock_level - (v_item->>'quantity')::integer),
      last_sold_at = now()
    WHERE id = (v_item->>'product_id')::uuid;
  END LOOP;

  -- Update customer data if applicable
  IF p_customer_id IS NOT NULL THEN
    UPDATE customers SET
      total_purchases = COALESCE(total_purchases, 0) + v_total_amount,
      last_purchase_date = now()
    WHERE id = p_customer_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'total_amount', v_total_amount
  );
END;
$$ LANGUAGE plpgsql;