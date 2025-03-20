/*
  # Sales Management System

  1. New Tables
    - `sales`: Stores all sales transactions with payment tracking
      - Includes validation for payment details
      - Links to customers, video calls, and quotations
      - Tracks payment status and history

  2. Functions
    - `process_sale_completion`: Handles the entire sale workflow
      - Creates quotation
      - Updates inventory
      - Updates customer history
      - Updates video call status
      - Manages payment tracking

  3. Security
    - Enables RLS on sales table
    - Adds policies for staff access
    - Includes proper validation checks
*/

-- Create sales table if not exists
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text NOT NULL,
  sale_type text NOT NULL CHECK (sale_type IN ('counter', 'video_call')),
  customer_id uuid REFERENCES customers(id),
  video_call_id uuid REFERENCES video_calls(id),
  quotation_id uuid REFERENCES quotations(id),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  payment_status text NOT NULL CHECK (payment_status IN ('paid', 'pending', 'partial', 'failed')),
  payment_details jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_payment_details CHECK (validate_payment_details_v2(payment_details))
);

-- Create function to process sale completion
CREATE OR REPLACE FUNCTION process_sale_completion(
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
BEGIN
  -- Validate sale type
  IF p_sale_type NOT IN ('counter', 'video_call') THEN
    RAISE EXCEPTION 'Invalid sale type: %', p_sale_type;
  END IF;

  -- Validate payment details
  IF NOT validate_payment_details_v2(p_payment_details) THEN
    RAISE EXCEPTION 'Invalid payment details structure';
  END IF;

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
    (p_quotation_data->>'total_amount')::numeric,
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
    (p_quotation_data->>'total_amount')::numeric,
    p_payment_details->>'payment_status',
    p_payment_details
  ) RETURNING id INTO v_sale_id;

  -- Update customer purchase history
  IF p_customer_id IS NOT NULL THEN
    PERFORM update_customer_total_purchases(
      p_customer_id,
      (p_quotation_data->>'total_amount')::numeric
    );
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
      bill_amount = (p_quotation_data->>'total_amount')::numeric,
      bill_generated_at = now(),
      bill_paid_at = CASE WHEN p_payment_details->>'payment_status' = 'completed' THEN now() ELSE null END
    WHERE id = p_video_call_id;
  END IF;

  -- Update product stock levels
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_quotation_data->'items')
  LOOP
    PERFORM update_product_stock_level(
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::integer
    );
  END LOOP;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on sales table
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Staff can view all sales" ON sales;
DROP POLICY IF EXISTS "Staff can insert sales" ON sales;

-- Create RLS policies for sales table
CREATE POLICY "Staff can view all sales"
  ON sales
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert sales"
  ON sales
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_video_call_id ON sales(video_call_id);
CREATE INDEX IF NOT EXISTS idx_sales_quotation_id ON sales(quotation_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);