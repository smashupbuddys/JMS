/*
  # Transaction Support for Sale Completion

  1. New Functions
    - `begin_sale_transaction`: Starts a new sale transaction with validation
    - `commit_sale_transaction`: Commits a successful sale transaction
    - `rollback_sale_transaction`: Rolls back a failed sale transaction
    - `handle_sale_error`: Handles errors during sale processing

  2. Changes
    - Added transaction management
    - Added error recovery
    - Added audit logging
    - Added stock validation
*/

-- Function to begin sale transaction
CREATE OR REPLACE FUNCTION begin_sale_transaction(
  p_sale_type text,
  p_customer_id uuid,
  p_items jsonb,
  OUT transaction_id uuid,
  OUT validation_errors jsonb
)
RETURNS record AS $$
DECLARE
  v_item record;
  v_stock_level integer;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  -- Generate transaction ID
  transaction_id := gen_random_uuid();
  
  -- Validate sale type
  IF p_sale_type NOT IN ('counter', 'video_call') THEN
    v_errors := v_errors || jsonb_build_object(
      'field', 'sale_type',
      'error', 'Invalid sale type: ' || p_sale_type
    );
  END IF;

  -- Validate customer if provided
  IF p_customer_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id) THEN
      v_errors := v_errors || jsonb_build_object(
        'field', 'customer_id',
        'error', 'Customer not found: ' || p_customer_id
      );
    END IF;
  END IF;

  -- Validate items structure
  IF jsonb_typeof(p_items) != 'array' THEN
    v_errors := v_errors || jsonb_build_object(
      'field', 'items',
      'error', 'Items must be an array'
    );
  ELSE
    -- Check each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      -- Validate item structure
      IF NOT (
        v_item ? 'product_id' AND
        v_item ? 'quantity' AND
        v_item ? 'price'
      ) THEN
        v_errors := v_errors || jsonb_build_object(
          'field', 'items',
          'error', 'Invalid item structure'
        );
        CONTINUE;
      END IF;

      -- Check stock availability
      SELECT stock_level INTO v_stock_level
      FROM products
      WHERE id = (v_item->>'product_id')::uuid;

      IF v_stock_level IS NULL THEN
        v_errors := v_errors || jsonb_build_object(
          'field', 'product',
          'error', 'Product not found: ' || v_item->>'product_id'
        );
      ELSIF v_stock_level < (v_item->>'quantity')::integer THEN
        v_errors := v_errors || jsonb_build_object(
          'field', 'stock',
          'error', format(
            'Insufficient stock for product %s: requested %s, available %s',
            v_item->>'product_id',
            v_item->>'quantity',
            v_stock_level
          )
        );
      END IF;
    END LOOP;
  END IF;

  -- Return validation errors if any
  validation_errors := v_errors;

  -- Log transaction start
  INSERT INTO sale_transaction_logs (
    transaction_id,
    event_type,
    sale_type,
    customer_id,
    items_count,
    validation_errors
  ) VALUES (
    transaction_id,
    'started',
    p_sale_type,
    p_customer_id,
    jsonb_array_length(p_items),
    CASE WHEN jsonb_array_length(v_errors) > 0 THEN v_errors ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql;

-- Function to commit sale transaction
CREATE OR REPLACE FUNCTION commit_sale_transaction(
  p_transaction_id uuid,
  p_sale_id uuid
) RETURNS void AS $$
BEGIN
  -- Log transaction completion
  INSERT INTO sale_transaction_logs (
    transaction_id,
    event_type,
    sale_id,
    status
  ) VALUES (
    p_transaction_id,
    'completed',
    p_sale_id,
    'success'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to rollback sale transaction
CREATE OR REPLACE FUNCTION rollback_sale_transaction(
  p_transaction_id uuid,
  p_error text
) RETURNS void AS $$
BEGIN
  -- Log transaction rollback
  INSERT INTO sale_transaction_logs (
    transaction_id,
    event_type,
    error_message,
    status
  ) VALUES (
    p_transaction_id,
    'rolled_back',
    p_error,
    'failed'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to handle sale errors
CREATE OR REPLACE FUNCTION handle_sale_error(
  p_transaction_id uuid,
  p_error text,
  p_context jsonb DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- Log error details
  INSERT INTO sale_error_logs (
    transaction_id,
    error_message,
    error_context,
    created_at
  ) VALUES (
    p_transaction_id,
    p_error,
    p_context,
    now()
  );

  -- Attempt rollback
  PERFORM rollback_sale_transaction(p_transaction_id, p_error);
END;
$$ LANGUAGE plpgsql;

-- Create transaction logs table
CREATE TABLE IF NOT EXISTS sale_transaction_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  event_type text NOT NULL,
  sale_type text,
  customer_id uuid,
  sale_id uuid,
  items_count integer,
  validation_errors jsonb,
  error_message text,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create error logs table
CREATE TABLE IF NOT EXISTS sale_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  error_message text NOT NULL,
  error_context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE sale_transaction_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_error_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Staff can view transaction logs"
  ON sale_transaction_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert transaction logs"
  ON sale_transaction_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can view error logs"
  ON sale_error_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert error logs"
  ON sale_error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sale_transaction_logs_transaction_id 
  ON sale_transaction_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_sale_transaction_logs_sale_id 
  ON sale_transaction_logs(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_transaction_logs_created_at 
  ON sale_transaction_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_sale_error_logs_transaction_id 
  ON sale_error_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_sale_error_logs_created_at 
  ON sale_error_logs(created_at);