/*
  # Add Stock Error Tracking

  1. New Tables
    - `stock_update_errors`
      - `id` (uuid, primary key)
      - `product_id` (uuid, references products)
      - `attempted_quantity` (integer)
      - `current_stock` (integer)
      - `error_message` (text)
      - `error_code` (text)
      - `transaction_id` (uuid)
      - `created_at` (timestamptz)
      - `resolved_at` (timestamptz)
      - `resolved_by` (uuid)
      - `resolution_notes` (text)

  2. Security
    - Enable RLS on `stock_update_errors` table
    - Add policy for authenticated users to read errors
    - Add policy for staff to create errors
    - Add policy for managers to resolve errors

  3. Functions
    - Add function to log stock update errors
    - Add function to resolve stock update errors
*/

-- Create stock update errors table
CREATE TABLE IF NOT EXISTS stock_update_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  attempted_quantity integer NOT NULL,
  current_stock integer NOT NULL,
  error_message text NOT NULL,
  error_code text,
  transaction_id uuid,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES staff(id),
  resolution_notes text,
  CONSTRAINT positive_attempted_quantity CHECK (attempted_quantity > 0),
  CONSTRAINT non_negative_current_stock CHECK (current_stock >= 0)
);

-- Enable RLS
ALTER TABLE stock_update_errors ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Staff can view stock errors"
  ON stock_update_errors
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can create stock errors"
  ON stock_update_errors
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Managers can resolve stock errors"
  ON stock_update_errors
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Function to log stock update errors
CREATE OR REPLACE FUNCTION log_stock_error(
  p_product_id uuid,
  p_attempted_quantity integer,
  p_current_stock integer,
  p_error_message text,
  p_error_code text DEFAULT NULL,
  p_transaction_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_error_id uuid;
BEGIN
  INSERT INTO stock_update_errors (
    product_id,
    attempted_quantity,
    current_stock,
    error_message,
    error_code,
    transaction_id
  ) VALUES (
    p_product_id,
    p_attempted_quantity,
    p_current_stock,
    p_error_message,
    p_error_code,
    p_transaction_id
  )
  RETURNING id INTO v_error_id;

  -- Create notification for staff
  INSERT INTO notifications (
    type,
    title,
    message,
    data
  ) VALUES (
    'stock_error',
    'Stock Update Error',
    p_error_message,
    jsonb_build_object(
      'error_id', v_error_id,
      'product_id', p_product_id,
      'attempted_quantity', p_attempted_quantity,
      'current_stock', p_current_stock
    )
  );

  RETURN v_error_id;
END;
$$;

-- Function to resolve stock errors
CREATE OR REPLACE FUNCTION resolve_stock_error(
  p_error_id uuid,
  p_resolution_notes text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user has permission
  IF NOT EXISTS (
    SELECT 1 FROM staff
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to resolve stock errors';
  END IF;

  -- Update error record
  UPDATE stock_update_errors
  SET resolved_at = now(),
      resolved_by = auth.uid(),
      resolution_notes = p_resolution_notes
  WHERE id = p_error_id;

  -- Create resolution notification
  INSERT INTO notifications (
    type,
    title,
    message,
    data
  ) VALUES (
    'stock_error_resolved',
    'Stock Error Resolved',
    p_resolution_notes,
    jsonb_build_object(
      'error_id', p_error_id,
      'resolved_by', auth.uid(),
      'resolved_at', now()
    )
  );

  RETURN true;
END;
$$;