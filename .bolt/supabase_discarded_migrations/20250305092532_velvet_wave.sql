/*
  # Bulk Sale Processing Support

  1. New Functions
    - `process_bulk_sale`: Handles bulk sale processing with batching
    - `validate_bulk_items`: Validates bulk item structure and stock
    - `update_stock_in_batch`: Updates stock levels in batches
    - `log_bulk_sale`: Logs bulk sale completion

  2. Changes
    - Added bulk sale processing
    - Added batch stock updates
    - Added bulk sale logging
    - Added performance optimizations
*/

-- Function to validate bulk items
CREATE OR REPLACE FUNCTION validate_bulk_items(
  p_items jsonb,
  OUT valid boolean,
  OUT errors jsonb
)
RETURNS record AS $$
DECLARE
  v_item record;
  v_stock_level integer;
  v_error_list jsonb := '[]'::jsonb;
BEGIN
  -- Check if items is an array
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
    -- Check item structure
    IF NOT (
      v_item ? 'product_id' AND
      v_item ? 'quantity' AND
      v_item ? 'price'
    ) THEN
      v_error_list := v_error_list || jsonb_build_object(
        'error', 'Invalid item structure',
        'field', 'item',
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
        'field', 'product_id',
        'value', v_item->>'product_id'
      );
    ELSIF v_stock_level < (v_item->>'quantity')::integer THEN
      v_error_list := v_error_list || jsonb_build_object(
        'error', format(
          'Insufficient stock: requested %s, available %s',
          v_item->>'quantity',
          v_stock_level
        ),
        'field', 'quantity',
        'product_id', v_item->>'product_id'
      );
    END IF;
  END LOOP;

  valid := jsonb_array_length(v_error_list) = 0;
  errors := v_error_list;
END;
$$ LANGUAGE plpgsql;

-- Function to update stock in batches
CREATE OR REPLACE FUNCTION update_stock_in_batch(
  p_items jsonb,
  p_batch_size integer DEFAULT 100
)
RETURNS void AS $$
DECLARE
  v_item record;
  v_batch_count integer := 0;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Update stock level
    UPDATE products SET
      stock_level = GREATEST(0, stock_level - (v_item->>'quantity')::integer),
      last_sold_at = now()
    WHERE id = (v_item->>'product_id')::uuid;

    -- Increment batch counter
    v_batch_count := v_batch_count + 1;

    -- Commit batch if batch size reached
    IF v_batch_count >= p_batch_size THEN
      COMMIT;
      v_batch_count := 0;
    END IF;
  END LOOP;

  -- Final commit for any remaining items
  IF v_batch_count > 0 THEN
    COMMIT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to process bulk sale
CREATE OR REPLACE FUNCTION process_bulk_sale(
  p_sale_type text,
  p_customer_id uuid,
  p_items jsonb,
  p_payment_details jsonb,
  p_batch_size integer DEFAULT 100
)
RETURNS uuid AS $$
DECLARE
  v_transaction_id uuid;
  v_sale_id uuid;
  v_validation record;
  v_total_amount numeric := 0;
  v_total_items integer := 0;
BEGIN
  -- Start transaction
  v_transaction_id := gen_random_uuid();

  -- Validate items
  SELECT * INTO v_validation
  FROM validate_bulk_items(p_items);

  IF NOT v_validation.valid THEN
    PERFORM handle_sale_error(
      v_transaction_id,
      'Invalid items in bulk sale',
      v_validation.errors
    );
    RAISE EXCEPTION 'Invalid items in bulk sale: %', v_validation.errors;
  END IF;

  -- Calculate totals
  SELECT 
    SUM((item->>'quantity')::integer),
    SUM((item->>'price')::numeric * (item->>'quantity')::integer)
  INTO v_total_items, v_total_amount
  FROM jsonb_array_elements(p_items) as item;

  -- Create sale record
  INSERT INTO sales (
    sale_number,
    sale_type,
    customer_id,
    total_amount,
    payment_status,
    payment_details
  ) VALUES (
    'BULK-' || to_char(now(), 'YYYYMMDD-HH24MISS'),
    p_sale_type,
    p_customer_id,
    v_total_amount,
    p_payment_details->>'payment_status',
    p_payment_details
  ) RETURNING id INTO v_sale_id;

  -- Update stock levels in batches
  PERFORM update_stock_in_batch(p_items, p_batch_size);

  -- Update customer total purchases if applicable
  IF p_customer_id IS NOT NULL THEN
    UPDATE customers SET
      total_purchases = COALESCE(total_purchases, 0) + v_total_amount,
      last_purchase_date = now()
    WHERE id = p_customer_id;
  END IF;

  -- Log bulk sale completion
  INSERT INTO sale_logs (
    sale_id,
    sale_type,
    customer_id,
    total_amount,
    items_count,
    event_type
  ) VALUES (
    v_sale_id,
    p_sale_type,
    p_customer_id,
    v_total_amount,
    v_total_items,
    'bulk_completed'
  );

  -- Commit transaction
  PERFORM commit_sale_transaction(v_transaction_id, v_sale_id);

  RETURN v_sale_id;
EXCEPTION WHEN OTHERS THEN
  -- Log error and rollback
  PERFORM handle_sale_error(
    v_transaction_id,
    SQLERRM,
    jsonb_build_object(
      'sale_type', p_sale_type,
      'customer_id', p_customer_id,
      'total_items', v_total_items,
      'total_amount', v_total_amount
    )
  );
  RAISE;
END;
$$ LANGUAGE plpgsql;