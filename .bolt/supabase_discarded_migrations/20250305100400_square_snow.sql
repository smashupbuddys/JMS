/*
  # Enhanced Bulk Sale Processing Functions

  1. New Functions
    - `process_bulk_sale_v4`: Improved bulk sale processing with retries and error recovery
    - `validate_bulk_sale_v4`: Enhanced validation with detailed error reporting
    - `update_stock_batch_v4`: Optimized batch stock updates with retry logic
    - `log_bulk_transaction_v3`: Detailed transaction logging with performance metrics

  2. Changes
    - Added retry logic for network issues
    - Added performance monitoring
    - Added detailed error context
    - Added transaction recovery
*/

-- Function to validate bulk sale data with enhanced error reporting
CREATE OR REPLACE FUNCTION validate_bulk_sale_v4(
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
    'errors_found', jsonb_array_length(v_error_list),
    'total_amount', v_total_amount
  );

  valid := jsonb_array_length(v_error_list) = 0;
  errors := v_error_list;
END;
$$ LANGUAGE plpgsql;

-- Function to update stock in batches with enhanced retry logic
CREATE OR REPLACE FUNCTION update_stock_batch_v4(
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
  v_batch_metrics jsonb[];
BEGIN
  v_start_time := clock_timestamp();

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Reset retry counter for each item
    v_retry_count := 0;
    v_success := false;
    
    -- Record batch start time
    v_batch_metrics := v_batch_metrics || jsonb_build_object(
      'batch_start', clock_timestamp(),
      'product_id', v_item->>'product_id',
      'quantity', (v_item->>'quantity')::integer
    );

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

        -- Update batch metrics
        v_batch_metrics[array_length(v_batch_metrics, 1)] := v_batch_metrics[array_length(v_batch_metrics, 1)] || 
          jsonb_build_object(
            'batch_end', clock_timestamp(),
            'success', true,
            'retries', v_retry_count
          );

      EXCEPTION WHEN OTHERS THEN
        v_retry_count := v_retry_count + 1;
        v_error := SQLERRM;
        
        -- Log retry attempt with enhanced context
        INSERT INTO stock_update_retry_logs (
          product_id,
          attempt_number,
          error_message,
          error_context,
          created_at
        ) VALUES (
          (v_item->>'product_id')::uuid,
          v_retry_count,
          v_error,
          jsonb_build_object(
            'quantity', (v_item->>'quantity')::integer,
            'current_stock', (
              SELECT stock_level 
              FROM products 
              WHERE id = (v_item->>'product_id')::uuid
            ),
            'batch_number', v_batch_count,
            'total_retries', v_retry_count
          ),
          now()
        );

        -- Wait before retrying (exponential backoff with jitter)
        PERFORM pg_sleep(
          power(2, v_retry_count)::integer * (0.5 + random() * 0.5)
        );
        
        IF v_retry_count = p_max_retries THEN
          -- Update batch metrics with failure
          v_batch_metrics[array_length(v_batch_metrics, 1)] := v_batch_metrics[array_length(v_batch_metrics, 1)] || 
            jsonb_build_object(
              'batch_end', clock_timestamp(),
              'success', false,
              'retries', v_retry_count,
              'error', v_error
            );
            
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

  -- Calculate detailed performance metrics
  v_performance_metrics := jsonb_build_object(
    'total_duration_ms', EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000,
    'items_processed', v_total_updated,
    'average_time_per_item_ms', 
    CASE WHEN v_total_updated > 0 
      THEN EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000 / v_total_updated
      ELSE 0 
    END,
    'batch_size', p_batch_size,
    'batch_metrics', to_jsonb(v_batch_metrics),
    'success_rate', CASE WHEN v_total_updated > 0 
      THEN (v_total_updated::float / jsonb_array_length(p_items)) * 100 
      ELSE 0 
    END
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

-- Function to process bulk sale with enhanced error handling and recovery
CREATE OR REPLACE FUNCTION process_bulk_sale_v4(
  p_sale_type text,
  p_customer_id uuid,
  p_items jsonb,
  p_payment_details jsonb,
  p_batch_size integer DEFAULT 100,
  p_max_retries integer DEFAULT 3
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
  v_retry_count integer := 0;
  v_success boolean := false;
  v_error text;
  v_performance_metrics jsonb;
BEGIN
  -- Start timing
  v_start_time := clock_timestamp();
  
  -- Generate transaction ID
  v_transaction_id := gen_random_uuid();

  -- Validate input data
  SELECT * INTO v_validation
  FROM validate_bulk_sale_v4(p_items, p_payment_details);

  IF NOT v_validation.valid THEN
    PERFORM log_bulk_transaction_v3(
      v_transaction_id,
      'validation_failed',
      v_validation.errors,
      v_validation.performance_metrics
    );
    RETURN jsonb_build_object(
      'success', false,
      'errors', v_validation.errors,
      'performance_metrics', v_validation.performance_metrics
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

  -- Process sale with retries
  WHILE v_retry_count < p_max_retries AND NOT v_success LOOP
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

      -- Update stock levels with retry logic
      v_performance_metrics := update_stock_batch_v4(
        p_items,
        p_batch_size,
        p_max_retries
      );

      -- Update customer data if applicable
      IF p_customer_id IS NOT NULL THEN
        UPDATE customers SET
          total_purchases = COALESCE(total_purchases, 0) + v_total_amount,
          last_purchase_date = now(),
          updated_at = now()
        WHERE id = p_customer_id;
      END IF;

      v_success := true;

      -- Log successful transaction
      PERFORM log_bulk_transaction_v3(
        v_transaction_id,
        'completed',
        jsonb_build_object(
          'sale_id', v_sale_id,
          'total_amount', v_total_amount,
          'total_items', v_total_items,
          'duration_ms', EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000
        ),
        v_performance_metrics
      );

      -- Return success response
      RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'transaction_id', v_transaction_id,
        'total_amount', v_total_amount,
        'total_items', v_total_items,
        'performance_metrics', v_performance_metrics
      );

    EXCEPTION WHEN OTHERS THEN
      v_retry_count := v_retry_count + 1;
      v_error := SQLERRM;

      -- Log retry attempt
      PERFORM log_bulk_transaction_v3(
        v_transaction_id,
        'retry',
        jsonb_build_object(
          'attempt', v_retry_count,
          'error', v_error,
          'context', jsonb_build_object(
            'sale_type', p_sale_type,
            'customer_id', p_customer_id,
            'total_items', v_total_items,
            'total_amount', v_total_amount
          )
        ),
        NULL
      );

      -- Wait before retrying (exponential backoff with jitter)
      PERFORM pg_sleep(
        power(2, v_retry_count)::integer * (0.5 + random() * 0.5)
      );
      
      IF v_retry_count = p_max_retries THEN
        -- Log final error
        PERFORM log_bulk_transaction_v3(
          v_transaction_id,
          'error',
          jsonb_build_object(
            'error', v_error,
            'context', jsonb_build_object(
              'sale_type', p_sale_type,
              'customer_id', p_customer_id,
              'total_items', v_total_items,
              'total_amount', v_total_amount,
              'retries', v_retry_count
            )
          ),
          NULL
        );
        
        RAISE EXCEPTION 'Failed to process bulk sale after % retries: %', p_max_retries, v_error;
      END IF;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to log bulk transactions with enhanced metrics
CREATE OR REPLACE FUNCTION log_bulk_transaction_v3(
  p_transaction_id uuid,
  p_status text,
  p_details jsonb,
  p_performance_metrics jsonb
)
RETURNS void AS $$
BEGIN
  INSERT INTO bulk_transaction_logs (
    transaction_id,
    status,
    details,
    performance_metrics,
    created_at
  ) VALUES (
    p_transaction_id,
    p_status,
    p_details,
    p_performance_metrics,
    now()
  );
END;
$$ LANGUAGE plpgsql;

-- Add error_context column to stock_update_retry_logs if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'stock_update_retry_logs' 
    AND column_name = 'error_context'
  ) THEN
    ALTER TABLE stock_update_retry_logs 
    ADD COLUMN error_context jsonb;
  END IF;
END $$;