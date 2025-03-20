/*
  # Payment Validation and Sales Processing System

  1. Tables
    - Creates sales table for tracking all sales transactions
    - Adds proper constraints and RLS policies
    - Creates necessary indexes for performance

  2. Functions
    - Payment validation functions with improved error handling
    - Atomic sale processing function
    - Customer and inventory update functions

  3. Security
    - Enables RLS
    - Adds appropriate policies
    - Validates all inputs
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
  updated_at timestamptz DEFAULT now()
);

-- Create function to validate numeric amounts
CREATE OR REPLACE FUNCTION validate_numeric_amount(amount jsonb)
RETURNS boolean AS $$
BEGIN
  RETURN (
    jsonb_typeof(amount) = 'number' OR 
    (jsonb_typeof(amount) = 'string' AND amount::text ~ '^[0-9]+\.?[0-9]*$')
  );
END;
$$ LANGUAGE plpgsql;

-- Function to validate payment object structure
CREATE OR REPLACE FUNCTION validate_single_payment(payment jsonb)
RETURNS boolean AS $$
BEGIN
  RETURN (
    payment ? 'amount' AND
    payment ? 'date' AND
    payment ? 'type' AND
    payment ? 'method' AND
    validate_numeric_amount(payment->'amount') AND
    jsonb_typeof(payment->'date') = 'string' AND
    jsonb_typeof(payment->'type') = 'string' AND
    jsonb_typeof(payment->'method') = 'string'
  );
END;
$$ LANGUAGE plpgsql;

-- Main payment validation function
CREATE OR REPLACE FUNCTION validate_full_payment(details jsonb)
RETURNS boolean AS $$
DECLARE
  payment jsonb;
  total_paid numeric := 0;
  total_amount numeric;
  paid_amount numeric;
  pending_amount numeric;
BEGIN
  -- Check required fields
  IF NOT (
    details ? 'total_amount' AND
    details ? 'paid_amount' AND
    details ? 'pending_amount' AND
    details ? 'payment_status' AND
    details ? 'payments'
  ) THEN
    RAISE EXCEPTION 'Missing required payment fields';
  END IF;

  -- Parse numeric values
  total_amount := (details->>'total_amount')::numeric;
  paid_amount := (details->>'paid_amount')::numeric;
  pending_amount := (details->>'pending_amount')::numeric;

  -- Validate amounts
  IF NOT (
    validate_numeric_amount(details->'total_amount') AND
    validate_numeric_amount(details->'paid_amount') AND
    validate_numeric_amount(details->'pending_amount')
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

  -- Sum up all payments and validate each one
  FOR payment IN SELECT * FROM jsonb_array_elements(details->'payments')
  LOOP
    IF NOT validate_single_payment(payment) THEN
      RAISE EXCEPTION 'Invalid payment object structure';
    END IF;
    total_paid := total_paid + (payment->>'amount')::numeric;
  END LOOP;

  -- Verify amounts match
  IF ABS(total_paid - paid_amount) > 0.01 THEN
    RAISE EXCEPTION 'Payment amounts do not match payments array total';
  END IF;

  IF ABS((total_amount - paid_amount) - pending_amount) > 0.01 THEN
    RAISE EXCEPTION 'Total amount does not match paid + pending amounts';
  END IF;

  -- Validate status matches amounts
  CASE details->>'payment_status'
    WHEN 'completed' THEN
      IF pending_amount > 0 THEN
        RAISE EXCEPTION 'Completed payment cannot have pending amount';
      END IF;
    WHEN 'pending' THEN
      IF paid_amount > 0 THEN
        RAISE EXCEPTION 'Pending payment cannot have paid amount';
      END IF;
    WHEN 'partial' THEN
      IF paid_amount = 0 OR paid_amount >= total_amount THEN
        RAISE EXCEPTION 'Partial payment must have paid amount between 0 and total';
      END IF;
    WHEN 'failed' THEN
      IF paid_amount > 0 THEN
        RAISE EXCEPTION 'Failed payment cannot have paid amount';
      END IF;
  END CASE;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to process complete sale
CREATE OR REPLACE FUNCTION process_complete_sale(
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
  IF NOT validate_full_payment(p_payment_details) THEN
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

-- Enable RLS on sales table
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_video_call_id ON sales(video_call_id);
CREATE INDEX IF NOT EXISTS idx_sales_quotation_id ON sales(quotation_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Staff can view all sales" ON sales;
DROP POLICY IF EXISTS "Staff can insert sales" ON sales;

-- Create RLS policies for sales table
CREATE POLICY "Allow staff to view all sales"
  ON sales
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow staff to insert sales"
  ON sales
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add trigger for payment validation
CREATE OR REPLACE FUNCTION validate_quotation_payment()
RETURNS trigger AS $$
BEGIN
  -- Skip validation for null payment details
  IF NEW.payment_details IS NULL THEN
    RETURN NEW;
  END IF;

  -- Validate payment details
  IF NOT validate_full_payment(NEW.payment_details) THEN
    RAISE EXCEPTION 'Invalid payment details structure';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS validate_quotation_payment_trigger ON quotations;
CREATE TRIGGER validate_quotation_payment_trigger
  BEFORE INSERT OR UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION validate_quotation_payment();