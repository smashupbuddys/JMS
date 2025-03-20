/*
  # Stock Management System

  1. New Tables
    - `stock_update_errors` - Logs stock update errors for tracking and debugging
    - `stock_update_history` - Tracks all stock changes for auditing

  2. Functions
    - `update_product_stock` - Handles stock updates with error logging
    - `log_stock_error` - Records stock update errors
    - `track_stock_history` - Maintains stock update history

  3. Security
    - Enables RLS on all tables
    - Adds appropriate policies for staff access
*/

-- Create stock update errors table
CREATE TABLE IF NOT EXISTS stock_update_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  attempted_quantity integer NOT NULL,
  current_stock integer NOT NULL,
  error_message text NOT NULL,
  error_code text,
  error_context jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create stock update history table
CREATE TABLE IF NOT EXISTS stock_update_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  previous_stock integer NOT NULL,
  new_stock integer NOT NULL,
  change_amount integer NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('sale', 'purchase', 'adjustment', 'return')),
  reference_id uuid,
  reference_type text,
  staff_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE stock_update_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_update_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Staff can view stock errors"
  ON stock_update_errors
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert stock errors"
  ON stock_update_errors
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can view stock history"
  ON stock_update_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert stock history"
  ON stock_update_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_stock_errors_product ON stock_update_errors(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_errors_created_at ON stock_update_errors(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_history_product ON stock_update_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_created_at ON stock_update_history(created_at);

-- Function to log stock errors
CREATE OR REPLACE FUNCTION log_stock_error(
  p_product_id uuid,
  p_attempted_quantity integer,
  p_current_stock integer,
  p_error_message text,
  p_error_code text DEFAULT NULL,
  p_error_context jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
  v_error_id uuid;
BEGIN
  INSERT INTO stock_update_errors (
    product_id,
    attempted_quantity,
    current_stock,
    error_message,
    error_code,
    error_context
  ) VALUES (
    p_product_id,
    p_attempted_quantity,
    p_current_stock,
    p_error_message,
    p_error_code,
    p_error_context
  ) RETURNING id INTO v_error_id;

  RETURN v_error_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track stock history
CREATE OR REPLACE FUNCTION track_stock_history(
  p_product_id uuid,
  p_previous_stock integer,
  p_new_stock integer,
  p_change_type text,
  p_reference_id uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_history_id uuid;
  v_staff_id uuid;
BEGIN
  -- Get current staff ID from session
  v_staff_id := auth.uid();

  INSERT INTO stock_update_history (
    product_id,
    previous_stock,
    new_stock,
    change_amount,
    change_type,
    reference_id,
    reference_type,
    staff_id
  ) VALUES (
    p_product_id,
    p_previous_stock,
    p_new_stock,
    p_new_stock - p_previous_stock,
    p_change_type,
    p_reference_id,
    p_reference_type,
    v_staff_id
  ) RETURNING id INTO v_history_id;

  RETURN v_history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS update_product_stock(uuid, integer, text, text, numeric);

-- Main function to update product stock
CREATE OR REPLACE FUNCTION update_product_stock(
  p_product_id uuid,
  p_quantity integer,
  p_manufacturer text,
  p_category text,
  p_price numeric
) RETURNS jsonb AS $$
DECLARE
  v_current_stock integer;
  v_new_stock integer;
  v_product_name text;
  v_result jsonb;
BEGIN
  -- Get current product details
  SELECT stock_level, name 
  INTO v_current_stock, v_product_name
  FROM products 
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    PERFORM log_stock_error(
      p_product_id,
      p_quantity,
      0,
      'Product not found',
      'PRODUCT_NOT_FOUND'
    );
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Product not found',
      'code', 'PRODUCT_NOT_FOUND'
    );
  END IF;

  -- Calculate new stock level
  v_new_stock := v_current_stock - p_quantity;

  -- Validate stock level
  IF v_new_stock < 0 THEN
    PERFORM log_stock_error(
      p_product_id,
      p_quantity,
      v_current_stock,
      'Insufficient stock',
      'INSUFFICIENT_STOCK',
      jsonb_build_object(
        'requested', p_quantity,
        'available', v_current_stock
      )
    );
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient stock',
      'code', 'INSUFFICIENT_STOCK',
      'details', jsonb_build_object(
        'requested', p_quantity,
        'available', v_current_stock
      )
    );
  END IF;

  -- Update stock
  UPDATE products SET
    stock_level = v_new_stock,
    last_sold_at = CASE 
      WHEN p_quantity > 0 THEN now()
      ELSE last_sold_at
    END
  WHERE id = p_product_id;

  -- Track history
  PERFORM track_stock_history(
    p_product_id,
    v_current_stock,
    v_new_stock,
    'sale'
  );

  -- Update manufacturer analytics
  UPDATE manufacturer_analytics SET
    total_sales = total_sales + (p_price * p_quantity),
    total_items = total_items + p_quantity,
    updated_at = now()
  WHERE manufacturer = p_manufacturer
  AND month = date_trunc('month', now());

  -- If no row was updated, insert new analytics
  IF NOT FOUND THEN
    INSERT INTO manufacturer_analytics (
      manufacturer,
      month,
      total_sales,
      total_items
    ) VALUES (
      p_manufacturer,
      date_trunc('month', now()),
      p_price * p_quantity,
      p_quantity
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'previous_stock', v_current_stock,
    'new_stock', v_new_stock,
    'change', -p_quantity
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;