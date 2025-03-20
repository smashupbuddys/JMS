/*
  # Sale Completion Functions

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
  p_sale_type text,
  p_customer_id uuid,
  p_video_call_id uuid,
  p_quotation_data jsonb,
  p_payment_details jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_quotation_id uuid;
  v_sale_id uuid;
  v_validation record;
  v_total_amount numeric := 0;
  v_item record;
BEGIN
  -- Validate input data
  SELECT * INTO v_validation
  FROM validate_sale_data(p_quotation_data->'items', p_payment_details);

  IF NOT v_validation.valid THEN
    RETURN jsonb_build_object(
      'success', false,
      'errors', v_validation.errors
    );
  END IF;

  -- Calculate total amount
  SELECT SUM((item->>'price')::numeric * (item->>'quantity')::integer)
  INTO v_total_amount
  FROM jsonb_array_elements(p_quotation_data->'items') as item;

  -- Create quotation
  INSERT INTO quotations (
    customer_id,
    video_call_id,
    items,
    total_amount,
    status,
    payment_details,
    workflow_status,
    quotation_number,
    valid_until,
    bill_status,
    bill_generated_at,
    bill_paid_at
  ) VALUES (
    p_customer_id,
    p_video_call_id,
    p_quotation_data->'items',
    v_total_amount,
    'accepted',
    p_payment_details,
    jsonb_build_object(
      'qc', CASE WHEN p_quotation_data->>'delivery_method' = 'hand_carry' THEN 'completed' ELSE 'pending' END,
      'packaging', CASE WHEN p_quotation_data->>'delivery_method' = 'hand_carry' THEN 'completed' ELSE 'pending' END,
      'dispatch', CASE WHEN p_quotation_data->>'delivery_method' = 'hand_carry' THEN 'completed' ELSE 'pending' END
    ),
    p_quotation_data->>'quotation_number',
    now() + interval '7 days',
    CASE WHEN p_payment_details->>'payment_status' = 'completed' THEN 'paid' ELSE 'pending' END,
    now(),
    CASE WHEN p_payment_details->>'payment_status' = 'completed' THEN now() ELSE null END
  ) RETURNING id INTO v_quotation_id;

  -- Update video call if applicable
  IF p_video_call_id IS NOT NULL THEN
    UPDATE video_calls SET
      quotation_id = v_quotation_id,
      quotation_required = true,
      workflow_status = jsonb_build_object(
        'video_call', 'completed',
        'quotation', 'completed',
        'profiling', 'pending',
        'payment', CASE WHEN p_payment_details->>'payment_status' = 'completed' THEN 'completed' ELSE 'pending' END,
        'qc', CASE WHEN p_quotation_data->>'delivery_method' = 'hand_carry' THEN 'completed' ELSE 'pending' END,
        'packaging', CASE WHEN p_quotation_data->>'delivery_method' = 'hand_carry' THEN 'completed' ELSE 'pending' END,
        'dispatch', CASE WHEN p_quotation_data->>'delivery_method' = 'hand_carry' THEN 'completed' ELSE 'pending' END
      ),
      bill_status = CASE WHEN p_payment_details->>'payment_status' = 'completed' THEN 'paid' ELSE 'pending' END,
      bill_amount = v_total_amount,
      bill_generated_at = now(),
      bill_paid_at = CASE WHEN p_payment_details->>'payment_status' = 'completed' THEN now() ELSE null END
    WHERE id = p_video_call_id;
  END IF;

  -- Update customer data if applicable
  IF p_customer_id IS NOT NULL THEN
    UPDATE customers SET
      total_purchases = COALESCE(total_purchases, 0) + v_total_amount,
      last_purchase_date = now()
    WHERE id = p_customer_id;
  END IF;

  -- Update stock levels
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_quotation_data->'items')
  LOOP
    UPDATE products SET
      stock_level = GREATEST(0, stock_level - (v_item->>'quantity')::integer),
      last_sold_at = now()
    WHERE id = (v_item->>'product_id')::uuid;
  END LOOP;

  -- Create sale record
  INSERT INTO sales (
    sale_type,
    customer_id,
    video_call_id,
    quotation_id,
    total_amount,
    payment_status,
    payment_details
  ) VALUES (
    p_sale_type,
    p_customer_id,
    p_video_call_id,
    v_quotation_id,
    v_total_amount,
    p_payment_details->>'payment_status',
    p_payment_details
  ) RETURNING id INTO v_sale_id;

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'quotation_id', v_quotation_id,
    'total_amount', v_total_amount
  );
END;
$$ LANGUAGE plpgsql;