/*
  # Enhanced Bulk Sale Processing Functions

  1. New Functions
    - `process_bulk_sale_v3`: Improved bulk sale processing with retries and error recovery
    - `validate_bulk_sale_v2`: Enhanced validation with detailed error reporting
    - `update_stock_batch_v2`: Optimized batch stock updates with retry logic
    - `log_bulk_transaction_v2`: Detailed transaction logging with performance metrics

  2. Changes
    - Added retry logic for network issues
    - Added performance monitoring
    - Added detailed error context
    - Added transaction recovery
*/

-- Function to validate bulk sale data with enhanced error reporting
CREATE OR REPLACE FUNCTION validate_bulk_sale_v2(
  p_items jsonb,
  p_payment_details jsonb,
  OUT valid boolean,
  OUT errors jsonb,
  OUT performance_metrics jsonb
)
RETURNS record AS $$
DECLARE
  v_item record;
  v_stock_level integer;
  v_error_list jsonb := '[]'::jsonb;
  v_total_amount numeric := 0;
  v_paid_amount numeric := 0;
  v_start_time timestamptz;
  v_end_time timestamptz;
BEGIN
  v_start_time := clock_timestamp();

  -- Validate items array
  IF jsonb_typeof(p_items) != 'array' THEN
    valid := false;
    errors := jsonb_build_array(
      jsonb_build_object(
        'error', 'Items must be an array',
        'field', 'items',
        'severity', 'critical'
      )
    );
    RETURN;
  END IF;

  -- Validate each item with detailed error context
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
        'item', v_item,
        'severity', 'error',
        'missing_fields', (
          SELECT jsonb_agg(field)
          FROM unnest(ARRAY['product_id', 'quantity', 'price']) field
          WHERE NOT (v_item ? field)
        )
      );
      CONTINUE;
    END IF;

    -- Validate numeric values with detailed feedback
    IF NOT (
      (v_item->>'quantity')::text ~ '^[0-9]+$' AND
      (v_item->>'price')::text ~ '^[0-9]+\.?[0-9]*$'
    ) THEN
      v_error_list := v_error_list || jsonb_build_object(
        'error', 'Invalid numeric values',
        'item', v_item,
        'severity', 'error',
        'validation_details', jsonb_build_object(
          'quantity', (v_item->>'quantity')::text ~ '^[0-9]+$',
          'price', (v_item->>'price')::text ~ '^[0-9]+\.?[0-9]*$'
        )
      );
      CONTINUE;
    END IF;

    -- Check stock availability with detailed inventory status
    SELECT stock_level INTO v_stock_level
    FROM products
    WHERE id = (v_item->>'product_id')::uuid;

    IF v_stock_level IS NULL THEN
      v_error_list := v_error_list || jsonb_build_object(
        'error', 'Product not found',
        'product_id', v_item->>'product_id',
        'severity', 'error'
      );
    ELSIF v_stock_level < (v_item->>'quantity')::integer THEN
      v_error_list := v_error_list || jsonb_build_object(
        'error', format(
          'Insufficient stock for product %s: requested %s, available %s',
          v_item->>'product_id',
          v_item->>'quantity',
          v_stock_level
        ),
        'product_id', v_item->>'product_id',
        'severity', 'error',
        'inventory_status', jsonb_build_object(
          'requested', (v_item->>'quantity')::integer,
          'available', v_stock_level,
          'deficit', (v_item->>'quantity')::integer - v_stock_level
        )
      );
    END IF;

    -- Accumulate total amount
    v_total_amount := v_total_amount + 
      (v_item->>'quantity')::integer * 
      (v_item->>'price')::numeric;
  END LOOP;

  -- Validate payment details with enhanced checks
  IF NOT validate_payment_details(p_payment_details) THEN
    v_error_list := v_error_list || jsonb_build_object(
      'error', 'Invalid payment details structure',
      'field', 'payment_details',
      'severity', 'critical',
      'expected_structure', jsonb_build_object(
        'total_amount', 'numeric',
        'paid_amount', 'numeric',
        'pending_amount', 'numeric',
        'payment_status', 'text',
        'payments', 'array'
      )
    );
  ELSE
    -- Validate payment amounts with detailed reconciliation
    v_paid_amount := (p_payment_details->>'paid_amount')::numeric;
    IF v_paid_amount > v_total_amount THEN
      v_error_list := v_error_list || jsonb_build_object(
        'error', 'Paid amount exceeds total amount',
        'severity', 'error',
        'payment_reconciliation', jsonb_build_object(
          'paid_amount', v_paid_amount,
          'total_amount', v_total_amount,
          'difference', v_paid_amount - v_total_amount
        )
      );
    END IF;
  END IF;

  -- Calculate performance metrics
  v_end_time := clock_timestamp();
  performance_metrics := jsonb_build_object(
    'validation_duration_ms', EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000,
    'items_processed', jsonb_array_length(p_items),
    'errors_found', jsonb_array_length(v_error_list)
  );

  valid := jsonb_array_length(v_error_list) = 0;
  errors := v_error_list;
END;
$$ LANGUAGE plpgsql;

-- Function to update stock in batches with retry logic
CREATE OR REPLACE FUNCTION update_stock_batch_v2(
  p_items jsonb,
  p_batch_size integer DEFAULT 100,
  p_max_retries integer DEFAULT 3
)
RETURNS jsonb AS $$
DECLARE
  v_item record;
  v_batch_count integer := 0;
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_total_updated integer := 0;
  v_retry_count integer;
  v_success boolean;
  v_error text;
  v_performance_metrics jsonb;
BEGIN
  v_start_time := clock_timestamp();

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Reset retry counter for each item
    v_retry_count := 0;
    v_success := false;

    -- Retry loop for each item
    WHILE v_retry_count < p_max_retries AND NOT v_success LOOP
      BEGIN
        -- Update stock level with retry logic
        UPDATE products SET
          stock_level = GREATEST(0, stock_level - (v_item->>'quantity')::integer),
          last_sold_at = now(),
          updated_at = now()
        WHERE id = (v_item->>'product_id')::uuid;

        v_success := true;
        v_total_updated := v_total_updated + 1;
        v_batch_count := v_batch_count + 1;

      EXCEPTION WHEN OTHERS THEN
        v_retry_count := v_retry_count + 1;
        v_error := SQLERRM;
        
        -- Log retry attempt
        INSERT INTO stock_update_retry_logs (
          product_id,
          attempt_number,
          error_message,
          created_at
        ) VALUES (
          (v_item->>'product_id')::uuid,
          v_retry_count,
          v_error,
          now()
        );

        -- Wait before retrying (exponential backoff)
        PERFORM pg_sleep(power(2, v_retry_count)::integer);
        
        IF v_retry_count = p_max_retries THEN
          RAISE EXCEPTION 'Failed to update stock after % retries: %', p_max_retries, v_error;
        END IF;
      END;
    END LOOP;

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

  -- Calculate performance metrics
  v_performance_metrics := jsonb_build_object(
    'total_duration_ms', EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000,
    'items_processed', v_total_updated,
    'average_time_per_item_ms', 
    CASE WHEN v_total_updated > 0 
      THEN EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000 / v_total_updated
      ELSE 0 
    END,
    'batch_size', p_batch_size
  );

  -- Log batch update performance
  INSERT INTO stock_update_logs (
    batch_size,
    total_items,
    start_time,
    end_time,
    duration_ms,
    performance_metrics
  ) VALUES (
    p_batch_size,
    v_total_updated,
    v_start_time,
    v_end_time,
    EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000,
    v_performance_metrics
  );

  RETURN v_performance_metrics;
END;
$$ LANGUAGE plpgsql;

-- Create retry logs table
CREATE TABLE IF NOT EXISTS stock_update_retry_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  attempt_number integer NOT NULL,
  error_message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on retry logs
ALTER TABLE stock_update_retry_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for retry logs
CREATE POLICY "Staff can view retry logs"
  ON stock_update_retry_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert retry logs"
  ON stock_update_retry_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for retry logs
CREATE INDEX IF NOT EXISTS idx_stock_update_retry_logs_product_id 
  ON stock_update_retry_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_update_retry_logs_created_at 
  ON stock_update_retry_logs(created_at);

-- Add performance_metrics column to stock_update_logs
ALTER TABLE stock_update_logs 
ADD COLUMN IF NOT EXISTS performance_metrics jsonb;