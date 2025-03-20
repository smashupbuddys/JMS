/*
  # Payment Validation System

  1. Functions
    - `validate_payment_amount_v2`: Validates numeric payment amounts
    - `validate_payment_object_v2`: Validates individual payment objects
    - `validate_payment_details_v2`: Enhanced payment details validation
    - `process_sale_v2`: Atomic sale processing function

  2. Changes
    - Drops existing functions before recreating
    - Uses versioned function names to avoid conflicts
    - Improves validation and error handling
    - Adds atomic transaction processing
*/

-- Drop existing functions and triggers first
DROP FUNCTION IF EXISTS validate_payment_amount(jsonb);
DROP FUNCTION IF EXISTS validate_payment_object(jsonb);
DROP FUNCTION IF EXISTS validate_payment_details(jsonb);
DROP FUNCTION IF EXISTS process_sale(text, uuid, uuid, jsonb, jsonb);
DROP TRIGGER IF EXISTS validate_payment_details_trigger ON quotations;
DROP TRIGGER IF EXISTS validate_quotation_payment ON quotations;

-- Function to validate numeric amounts
CREATE OR REPLACE FUNCTION validate_payment_amount_v2(amount jsonb)
RETURNS boolean AS $$
BEGIN
  RETURN (
    jsonb_typeof(amount) = 'number' OR 
    (jsonb_typeof(amount) = 'string' AND amount::text ~ '^[0-9]+\.?[0-9]*$')
  );
END;
$$ LANGUAGE plpgsql;

-- Function to validate individual payment object
CREATE OR REPLACE FUNCTION validate_payment_object_v2(payment jsonb)
RETURNS boolean AS $$
BEGIN
  RETURN (
    payment ? 'amount' AND
    payment ? 'date' AND
    payment ? 'type' AND
    payment ? 'method' AND
    validate_payment_amount_v2(payment->'amount') AND
    jsonb_typeof(payment->'date') = 'string' AND
    jsonb_typeof(payment->'type') = 'string' AND
    jsonb_typeof(payment->'method') = 'string'
  );
END;
$$ LANGUAGE plpgsql;

-- Enhanced payment details validation
CREATE OR REPLACE FUNCTION validate_payment_details_v2(details jsonb)
RETURNS boolean AS $$
DECLARE
  payment jsonb;
BEGIN
  -- Check required fields exist
  IF NOT (
    details ? 'total_amount' AND
    details ? 'paid_amount' AND
    details ? 'pending_amount' AND
    details ? 'payment_status' AND
    details ? 'payments'
  ) THEN
    RAISE EXCEPTION 'Missing required payment fields';
  END IF;

  -- Validate amount fields
  IF NOT (
    validate_payment_amount_v2(details->'total_amount') AND
    validate_payment_amount_v2(details->'paid_amount') AND
    validate_payment_amount_v2(details->'pending_amount')
  ) THEN
    RAISE EXCEPTION 'Invalid payment amounts';
  END IF;

  -- Validate status
  IF NOT (
    jsonb_typeof(details->'payment_status') = 'string' AND
    details->>'payment_status' IN ('pending', 'partial', 'completed', 'failed')
  ) THEN
    RAISE EXCEPTION 'Invalid payment status';
  END IF;

  -- Validate payments array
  IF jsonb_typeof(details->'payments') != 'array' THEN
    RAISE EXCEPTION 'Payments must be an array';
  END IF;

  -- Validate each payment object
  FOR payment IN SELECT * FROM jsonb_array_elements(details->'payments')
  LOOP
    IF NOT validate_payment_object_v2(payment) THEN
      RAISE EXCEPTION 'Invalid payment object structure';
    END IF;
  END LOOP;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Atomic sale processing function
CREATE OR REPLACE FUNCTION process_sale_v2(
  p_sale_type text,
  p_customer_id uuid,
  p_video_call_id uuid,
  p_quotation_data jsonb,
  p_payment_details jsonb
) RETURNS uuid AS $$
DECLARE
  v_quotation_id uuid;
  v_sale_id uuid;
  v_item record;
  v_total_amount numeric;
  v_total_items integer;
BEGIN
  -- Input validation
  IF p_sale_type NOT IN ('counter', 'video_call') THEN
    RAISE EXCEPTION 'Invalid sale type: %', p_sale_type;
  END IF;

  -- Validate payment details
  IF NOT validate_payment_details_v2(p_payment_details) THEN
    RAISE EXCEPTION 'Invalid payment details';
  END IF;

  -- Calculate totals
  SELECT 
    SUM((item->>'quantity')::integer) as total_items,
    SUM((item->>'price')::numeric * (item->>'quantity')::integer) as total_amount
  INTO v_total_items, v_total_amount
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

  -- Update customer if applicable
  IF p_customer_id IS NOT NULL THEN
    UPDATE customers SET
      total_purchases = COALESCE(total_purchases, 0) + v_total_amount,
      last_purchase_date = now()
    WHERE id = p_customer_id;
  END IF;

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

  -- Update product stock levels
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_quotation_data->'items')
  LOOP
    UPDATE products SET
      stock_level = GREATEST(0, stock_level - (v_item->>'quantity')::integer),
      last_sold_at = now()
    WHERE id = (v_item->>'product_id')::uuid;
  END LOOP;

  -- Create sale record
  INSERT INTO sales (
    sale_number,
    sale_type,
    customer_id,
    video_call_id,
    quotation_id,
    total_amount,
    payment_status,
    payment_details
  ) VALUES (
    p_quotation_data->>'quotation_number',
    p_sale_type,
    p_customer_id,
    p_video_call_id,
    v_quotation_id,
    v_total_amount,
    p_payment_details->>'payment_status',
    p_payment_details
  ) RETURNING id INTO v_sale_id;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger using v2 function
CREATE TRIGGER validate_quotation_payment_v2
  BEFORE INSERT OR UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_details_v2();