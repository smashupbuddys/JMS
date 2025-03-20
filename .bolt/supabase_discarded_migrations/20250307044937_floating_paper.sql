/*
  # Payment and Stock Management Functions

  1. New Functions
    - `update_customer_total_purchases`: Updates customer purchase totals
    - `update_product_stock_level`: Updates product stock levels
    - `validate_payment_details_v2`: New version of payment validation
    - `quotations_payment_validation_v2`: Updated trigger function

  2. Changes
    - Drop existing functions before creating new ones
    - Improved validation logic for payment details
    - Better error handling and validation messages
    - Added stock level safety checks

  3. Security
    - All functions are SECURITY DEFINER for consistent execution
*/

-- Drop existing functions and triggers
DROP TRIGGER IF EXISTS validate_quotation_payment ON quotations;
DROP FUNCTION IF EXISTS quotations_payment_validation();
DROP FUNCTION IF EXISTS validate_payment_details(jsonb);
DROP FUNCTION IF EXISTS update_customer_total_purchases(uuid, numeric);
DROP FUNCTION IF EXISTS update_product_stock_level(uuid, integer);

-- Function to safely update customer total purchases
CREATE OR REPLACE FUNCTION update_customer_total_purchases(
  customer_id uuid,
  amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE customers 
  SET 
    total_purchases = COALESCE(total_purchases, 0) + amount,
    last_purchase_date = CURRENT_TIMESTAMP
  WHERE id = customer_id;
END;
$$;

-- Function to safely update product stock levels
CREATE OR REPLACE FUNCTION update_product_stock_level(
  product_id uuid,
  quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products
  SET
    stock_level = GREATEST(0, stock_level - quantity),
    last_sold_at = CURRENT_TIMESTAMP
  WHERE id = product_id;
END;
$$;

-- Updated payment details validation with new name
CREATE OR REPLACE FUNCTION validate_payment_details_v2(
  payment_details jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payment jsonb;
  total_amount numeric;
  paid_amount numeric;
  pending_amount numeric;
BEGIN
  -- Validate structure
  IF NOT (
    payment_details ? 'total_amount' AND
    payment_details ? 'paid_amount' AND
    payment_details ? 'pending_amount' AND
    payment_details ? 'payment_status' AND
    payment_details ? 'payments'
  ) THEN
    RAISE EXCEPTION 'Missing required payment detail fields';
  END IF;

  -- Parse and validate amounts
  BEGIN
    total_amount := (payment_details->>'total_amount')::numeric;
    paid_amount := (payment_details->>'paid_amount')::numeric;
    pending_amount := (payment_details->>'pending_amount')::numeric;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Invalid numeric values in payment amounts';
  END;

  -- Validate amounts are non-negative
  IF total_amount < 0 OR paid_amount < 0 OR pending_amount < 0 THEN
    RAISE EXCEPTION 'Payment amounts cannot be negative';
  END IF;

  -- Validate amounts reconcile
  IF abs(total_amount - (paid_amount + pending_amount)) > 0.01 THEN
    RAISE EXCEPTION 'Payment amounts do not reconcile (total ≠ paid + pending)';
  END IF;

  -- Validate payment status
  IF NOT (payment_details->>'payment_status' = ANY (ARRAY['pending', 'partial', 'completed', 'failed'])) THEN
    RAISE EXCEPTION 'Invalid payment status';
  END IF;

  -- Validate payments array
  IF jsonb_typeof(payment_details->'payments') != 'array' THEN
    RAISE EXCEPTION 'Payments must be an array';
  END IF;

  -- Validate each payment
  FOR payment IN SELECT * FROM jsonb_array_elements(payment_details->'payments')
  LOOP
    IF NOT (
      payment ? 'amount' AND
      payment ? 'date' AND
      payment ? 'type' AND
      payment ? 'method'
    ) THEN
      RAISE EXCEPTION 'Invalid payment structure in payments array';
    END IF;

    -- Validate payment amount
    BEGIN
      IF (payment->>'amount')::numeric < 0 THEN
        RAISE EXCEPTION 'Payment amount cannot be negative';
      END IF;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid payment amount value';
    END;

    -- Validate payment type
    IF NOT (payment->>'type' = ANY (ARRAY['full', 'partial', 'advance'])) THEN
      RAISE EXCEPTION 'Invalid payment type';
    END IF;

    -- Validate payment method
    IF NOT (payment->>'method' = ANY (ARRAY['cash', 'card', 'upi', 'bank_transfer'])) THEN
      RAISE EXCEPTION 'Invalid payment method';
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

-- Updated quotations trigger function with new name
CREATE OR REPLACE FUNCTION quotations_payment_validation_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Skip validation for null payment details
  IF NEW.payment_details IS NULL THEN
    RETURN NEW;
  END IF;

  -- Validate payment details
  IF NOT validate_payment_details_v2(NEW.payment_details) THEN
    RAISE EXCEPTION 'Invalid payment details structure';
  END IF;

  RETURN NEW;
END;
$$;

-- Create new trigger
CREATE TRIGGER validate_quotation_payment
  BEFORE INSERT OR UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION quotations_payment_validation_v2();

-- Add helpful comments
COMMENT ON FUNCTION update_customer_total_purchases(uuid, numeric) IS 'Safely updates customer total purchases and last purchase date';
COMMENT ON FUNCTION update_product_stock_level(uuid, integer) IS 'Safely updates product stock level and last sold date';
COMMENT ON FUNCTION validate_payment_details_v2(jsonb) IS 'Validates payment details structure and values with improved error handling';
COMMENT ON FUNCTION quotations_payment_validation_v2() IS 'Trigger function to validate quotation payment details';