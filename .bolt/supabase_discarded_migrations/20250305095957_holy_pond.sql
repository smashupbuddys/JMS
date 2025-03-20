/*
  # Bulk Sale Processing Functions

  1. New Functions
    - `process_bulk_sale_v2`: Enhanced bulk sale processing with better error handling
    - `validate_bulk_sale`: Comprehensive validation for bulk sales
    - `update_stock_batch`: Optimized batch stock updates
    - `log_bulk_transaction`: Detailed transaction logging

  2. Changes
    - Added transaction management
    - Added comprehensive validation
    - Added detailed error logging
    - Added performance optimizations
*/

-- Function to validate bulk sale data
CREATE OR REPLACE FUNCTION validate_bulk_sale(
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
  v_total_amount numeric := 0;
  v_paid_amount numeric := 0;
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

    -- Validate numeric values
    IF NOT (
      (v_item->>'quantity')::text ~ '^[0-9]+$' AND
      (v_item->>'price')::text ~ '^[0-9]+\.?[0-9]*$'
    ) THEN
      v_error_list := v_error_list || jsonb_build_object(
        'error', 'Invalid numeric values',
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

    -- Accumulate total amount
    v_total_amount := v_total_amount + 
      (v_item->>'quantity')::integer * 
      (v_item->>'price')::numeric;
  END LOOP;

  -- Validate payment details
  IF NOT validate_payment_details(p_payment_details) THEN
    v_error_list := v_error_list || jsonb_build_object(
      'error', 'Invalid payment details structure',
      'field', 'payment_details'
    );
  ELSE
    -- Validate payment amounts
    v_paid_amount := (p_payment_details->>'paid_amount')::numeric;
    IF v_paid_amount > v_total_amount THEN
      v_error_list := v_error_list || jsonb_build_object(
        'error', 'Paid amount exceeds total amount',
        'paid_amount', v_paid_amount,
        'total_amount', v_total_amount
      );
    END IF;
  END IF;

  valid := jsonb_array_length(v_error_list) = 0;
  errors := v_error_list;
END;
$$ LANGUAGE plpgsql;

-- Function to update stock in optimized batches
CREATE OR REPLACE FUNCTION update_stock_batch(
  p_items jsonb,
  p_batch_size integer DEFAULT 100
)
RETURNS void AS $$
DECLARE
  v_item record;
  v_batch_count integer := 0;
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_total_updated integer := 0;
BEGIN
  v_start_time := clock_timestamp();

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Update stock level
    UPDATE products SET
      stock_level = GREATEST(0, stock_level - (v_item->>'quantity')::integer),
      last_sold_at = now(),
      updated_at = now()
    WHERE id = (v_item->>'product_id')::uuid;

    v_total_updated := v_total_updated + 1;
    v_batch_count := v_batch_count + 1;

    -- Commit batch if size reached
    IF v_batch_count >= p_batch_size THEN
      COMMIT;
      v_batch_count := 0;
    END IF;
  END LOOP;

  -- Final commit if needed
  IF v_batch_count > 0 THEN
    COMMIT;
  END IF;

  v_end_time := clock_timestamp();

  -- Log batch update performance
  INSERT INTO stock_update_logs (
    batch_size,
    total_items,
    start_time,
    end_time,
    duration_ms
  ) VALUES (
    p_batch_size,
    v_total_updated,
    v_start_time,
    v_end_time,
    EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000
  );
END;
$$ LANGUAGE plpgsql;

-- Function to process bulk sale with enhanced error handling
CREATE OR REPLACE FUNCTION process_bulk_sale_v2(
  p_sale_type text,
  p_customer_id uuid,
  p_items jsonb,
  p_payment_details jsonb,
  p_batch_size integer DEFAULT 100
)
RETURNS jsonb AS $$
DECLARE
  v_transaction_id uuid;
  v_sale_id uuid;
  v_validation record;
  v_total_amount numeric := 0;
  v_total_items integer := 0;
  v_start_time timestamptz;
  v_customer_type text;
BEGIN
  -- Start timing
  v_start_time := clock_timestamp();
  
  -- Generate transaction ID
  v_transaction_id := gen_random_uuid();

  -- Validate input data
  SELECT * INTO v_validation
  FROM validate_bulk_sale(p_items, p_payment_details);

  IF NOT v_validation.valid THEN
    PERFORM log_bulk_transaction(
      v_transaction_id,
      'validation_failed',
      v_validation.errors
    );
    RETURN jsonb_build_object(
      'success', false,
      'errors', v_validation.errors
    );
  END IF;

  -- Get customer type and validate
  v_customer_type := get_customer_type(p_customer_id);

  -- Calculate totals
  SELECT 
    SUM((item->>'quantity')::integer),
    SUM((item->>'price')::numeric * (item->>'quantity')::integer)
  INTO v_total_items, v_total_amount
  FROM jsonb_array_elements(p_items) as item;

  -- Begin transaction
  BEGIN
    -- Create sale record
    INSERT INTO sales (
      sale_number,
      sale_type,
      customer_id,
      total_amount,
      payment_status,
      payment_details,
      created_at
    ) VALUES (
      'BULK-' || to_char(now(), 'YYYYMMDD-HH24MISS'),
      p_sale_type,
      p_customer_id,
      v_total_amount,
      p_payment_details->>'payment_status',
      p_payment_details,
      now()
    ) RETURNING id INTO v_sale_id;

    -- Update stock levels
    PERFORM update_stock_batch(p_items, p_batch_size);

    -- Update customer data if applicable
    IF p_customer_id IS NOT NULL THEN
      UPDATE customers SET
        total_purchases = COALESCE(total_purchases, 0) + v_total_amount,
        last_purchase_date = now(),
        updated_at = now()
      WHERE id = p_customer_id;
    END IF;

    -- Log successful transaction
    PERFORM log_bulk_transaction(
      v_transaction_id,
      'completed',
      jsonb_build_object(
        'sale_id', v_sale_id,
        'total_amount', v_total_amount,
        'total_items', v_total_items,
        'duration_ms', EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000
      )
    );

    -- Return success response
    RETURN jsonb_build_object(
      'success', true,
      'sale_id', v_sale_id,
      'transaction_id', v_transaction_id,
      'total_amount', v_total_amount,
      'total_items', v_total_items,
      'duration_ms', EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000
    );

  EXCEPTION WHEN OTHERS THEN
    -- Log error and rollback
    PERFORM log_bulk_transaction(
      v_transaction_id,
      'error',
      jsonb_build_object(
        'error', SQLERRM,
        'context', jsonb_build_object(
          'sale_type', p_sale_type,
          'customer_id', p_customer_id,
          'total_items', v_total_items,
          'total_amount', v_total_amount
        )
      )
    );
    
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to log bulk transactions
CREATE OR REPLACE FUNCTION log_bulk_transaction(
  p_transaction_id uuid,
  p_status text,
  p_details jsonb
)
RETURNS void AS $$
BEGIN
  INSERT INTO bulk_transaction_logs (
    transaction_id,
    status,
    details,
    created_at
  ) VALUES (
    p_transaction_id,
    p_status,
    p_details,
    now()
  );
END;
$$ LANGUAGE plpgsql;

-- Create bulk transaction logs table
CREATE TABLE IF NOT EXISTS bulk_transaction_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  status text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL
);

-- Create stock update logs table
CREATE TABLE IF NOT EXISTS stock_update_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_size integer NOT NULL,
  total_items integer NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  duration_ms numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE bulk_transaction_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_update_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Staff can view bulk transaction logs"
  ON bulk_transaction_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert bulk transaction logs"
  ON bulk_transaction_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can view stock update logs"
  ON stock_update_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert stock update logs"
  ON stock_update_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bulk_transaction_logs_transaction_id 
  ON bulk_transaction_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_bulk_transaction_logs_status 
  ON bulk_transaction_logs(status);
CREATE INDEX IF NOT EXISTS idx_bulk_transaction_logs_created_at 
  ON bulk_transaction_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_stock_update_logs_created_at 
  ON stock_update_logs(created_at);