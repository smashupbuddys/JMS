/*
  # Stock Error Logging Migration

  1. New Tables
    - Creates stock_error_logs table for detailed error tracking
    - Adds comprehensive error metadata and context

  2. Changes
    - Adds error logging infrastructure
    - Includes detailed error context and metadata
    - Supports error analysis and debugging
*/

-- Create stock error logs table
CREATE TABLE IF NOT EXISTS stock_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_code text NOT NULL,
  error_type text NOT NULL,
  http_status integer,
  product_id uuid REFERENCES products(id),
  product_name text,
  error_message text NOT NULL,
  error_details jsonb,
  staff_id uuid,
  attempted_operation jsonb,
  stack_trace text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolution_notes text,
  metadata jsonb
);

-- Insert initial error log for schema issue
INSERT INTO stock_error_logs (
  error_code,
  error_type,
  http_status,
  product_name,
  error_message,
  error_details,
  created_at,
  metadata
) VALUES (
  '42P01',
  'database_relation',
  404,
  'Unknown Product',
  'relation ''stock_update_errors'' does not exist',
  jsonb_build_object(
    'schema_name', current_schema(),
    'requested_table', 'stock_update_errors',
    'available_tables', (
      SELECT jsonb_agg(tablename)
      FROM pg_tables
      WHERE schemaname = current_schema()
    )
  ),
  now(),
  jsonb_build_object(
    'environment', current_setting('app.settings.environment', true),
    'database_version', current_setting('server_version'),
    'application_name', current_setting('application_name', true)
  )
);

-- Create index for faster error lookups
CREATE INDEX IF NOT EXISTS idx_stock_error_logs_error_code ON stock_error_logs (error_code);
CREATE INDEX IF NOT EXISTS idx_stock_error_logs_created_at ON stock_error_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_stock_error_logs_product_id ON stock_error_logs (product_id);

-- Create function to log stock errors
CREATE OR REPLACE FUNCTION log_stock_error(
  p_error_code text,
  p_error_type text,
  p_http_status integer,
  p_product_id uuid,
  p_error_message text,
  p_error_details jsonb DEFAULT NULL,
  p_staff_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_error_id uuid;
BEGIN
  INSERT INTO stock_error_logs (
    error_code,
    error_type,
    http_status,
    product_id,
    product_name,
    error_message,
    error_details,
    staff_id,
    attempted_operation,
    created_at,
    metadata
  )
  VALUES (
    p_error_code,
    p_error_type,
    p_http_status,
    p_product_id,
    (SELECT name FROM products WHERE id = p_product_id),
    p_error_message,
    p_error_details,
    p_staff_id,
    jsonb_build_object(
      'function', 'update_product_stock',
      'timestamp', now(),
      'session_info', current_setting('session.user', true)
    ),
    now(),
    jsonb_build_object(
      'environment', current_setting('app.settings.environment', true),
      'database_version', current_setting('server_version'),
      'application_name', current_setting('application_name', true)
    )
  )
  RETURNING id INTO v_error_id;

  RETURN v_error_id;
END;
$$;