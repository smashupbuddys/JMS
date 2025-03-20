/*
  # Stock Error Logging Schema

  1. New Tables
    - `stock_update_errors`: Stores detailed error information for failed stock updates
    - `stock_update_history`: Tracks successful and failed stock updates
    
  2. Functions
    - `log_stock_error`: Function to log detailed error information
    - `get_stock_error_report`: Function to generate error reports
*/

-- Create stock update errors table
CREATE TABLE IF NOT EXISTS stock_update_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  error_code text NOT NULL,
  error_message text NOT NULL,
  constraint_name text,
  current_stock integer,
  requested_change integer,
  attempted_at timestamptz DEFAULT now(),
  staff_id uuid REFERENCES staff(id),
  transaction_details jsonb,
  stack_trace text,
  additional_context jsonb
);

-- Create stock update history table
CREATE TABLE IF NOT EXISTS stock_update_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  previous_stock integer,
  new_stock integer,
  change_amount integer,
  change_type text NOT NULL,
  status text NOT NULL,
  error_id uuid REFERENCES stock_update_errors(id),
  staff_id uuid REFERENCES staff(id),
  created_at timestamptz DEFAULT now()
);

-- Function to log stock errors
CREATE OR REPLACE FUNCTION log_stock_error(
  p_product_id uuid,
  p_error_code text,
  p_error_message text,
  p_constraint_name text DEFAULT NULL,
  p_current_stock integer DEFAULT NULL,
  p_requested_change integer DEFAULT NULL,
  p_staff_id uuid DEFAULT NULL,
  p_transaction_details jsonb DEFAULT NULL,
  p_stack_trace text DEFAULT NULL,
  p_additional_context jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_error_id uuid;
BEGIN
  -- Insert error record
  INSERT INTO stock_update_errors (
    product_id,
    error_code,
    error_message,
    constraint_name,
    current_stock,
    requested_change,
    staff_id,
    transaction_details,
    stack_trace,
    additional_context
  ) VALUES (
    p_product_id,
    p_error_code,
    p_error_message,
    p_constraint_name,
    p_current_stock,
    p_requested_change,
    p_staff_id,
    p_transaction_details,
    p_stack_trace,
    p_additional_context
  )
  RETURNING id INTO v_error_id;

  -- Log in history
  INSERT INTO stock_update_history (
    product_id,
    previous_stock,
    new_stock,
    change_amount,
    change_type,
    status,
    error_id,
    staff_id
  ) VALUES (
    p_product_id,
    p_current_stock,
    p_current_stock,
    p_requested_change,
    CASE 
      WHEN p_requested_change > 0 THEN 'increase'
      ELSE 'decrease'
    END,
    'failed',
    v_error_id,
    p_staff_id
  );

  -- Create notification for critical errors
  INSERT INTO notifications (
    type,
    title,
    message,
    data
  ) VALUES (
    'stock_update_error',
    'Stock Update Failed',
    format('Failed to update stock for product ID %s: %s', p_product_id, p_error_message),
    jsonb_build_object(
      'error_id', v_error_id,
      'product_id', p_product_id,
      'error_code', p_error_code,
      'current_stock', p_current_stock,
      'requested_change', p_requested_change
    )
  );

  RETURN v_error_id;
END;
$$;

-- Function to generate error report
CREATE OR REPLACE FUNCTION get_stock_error_report(
  p_error_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_report jsonb;
BEGIN
  SELECT jsonb_build_object(
    'error_id', e.id,
    'timestamp', e.attempted_at,
    'product', jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'sku', p.sku,
      'category', p.category,
      'manufacturer', p.manufacturer
    ),
    'error', jsonb_build_object(
      'code', e.error_code,
      'message', e.error_message,
      'constraint', e.constraint_name
    ),
    'stock_details', jsonb_build_object(
      'current_level', e.current_stock,
      'requested_change', e.requested_change,
      'would_be_level', e.current_stock + e.requested_change
    ),
    'staff', jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'role', s.role
    ),
    'transaction_details', e.transaction_details,
    'additional_context', e.additional_context,
    'previous_attempts', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'timestamp', h.created_at,
          'status', h.status,
          'change_amount', h.change_amount,
          'previous_stock', h.previous_stock,
          'new_stock', h.new_stock
        )
      )
      FROM stock_update_history h
      WHERE h.product_id = e.product_id
      AND h.created_at < e.attempted_at
      ORDER BY h.created_at DESC
      LIMIT 5
    )
  ) INTO v_report
  FROM stock_update_errors e
  JOIN products p ON p.id = e.product_id
  LEFT JOIN staff s ON s.id = e.staff_id
  WHERE e.id = p_error_id;

  RETURN v_report;
END;
$$;

-- Enable RLS
ALTER TABLE stock_update_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_update_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Staff can view stock errors"
  ON stock_update_errors
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can view stock history"
  ON stock_update_history
  FOR SELECT
  TO authenticated
  USING (true);