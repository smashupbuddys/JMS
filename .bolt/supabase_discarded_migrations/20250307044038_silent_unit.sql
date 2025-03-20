/*
  # Payment Validation Functions and Triggers

  1. New Functions
    - `validate_payment_array`: Validates payment array structure
    - `validate_payment_details`: Validates complete payment details structure
    - `validate_quotation_payment_details`: Trigger function for quotations table

  2. Changes
    - Add validation for payment details in quotations
    - Add trigger for automatic validation
    - Proper parameter handling to avoid conflicts

  3. Security
    - Functions are SECURITY DEFINER for consistent execution
*/

-- Drop existing functions and triggers if they exist
DROP TRIGGER IF EXISTS validate_payment_details_trigger ON quotations;
DROP FUNCTION IF EXISTS validate_quotation_payment_details();
DROP FUNCTION IF EXISTS validate_payment_details(jsonb);
DROP FUNCTION IF EXISTS validate_payment_array(jsonb);

-- Function to validate payment array structure
CREATE OR REPLACE FUNCTION validate_payment_array(payment_array jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payment jsonb;
BEGIN
  -- Check if payments is an array
  IF NOT jsonb_typeof(payment_array) = 'array' THEN
    RETURN false;
  END IF;

  -- Check each payment object structure
  FOR payment IN SELECT * FROM jsonb_array_elements(payment_array) LOOP
    IF NOT (
      payment ? 'amount' AND 
      payment ? 'date' AND 
      payment ? 'type' AND 
      payment ? 'method'
    ) THEN
      RETURN false;
    END IF;

    -- Validate amount is numeric
    IF NOT jsonb_typeof(payment->'amount') IN ('number', 'string') THEN
      RETURN false;
    END IF;

    -- Validate date is string
    IF NOT jsonb_typeof(payment->'date') = 'string' THEN
      RETURN false;
    END IF;

    -- Validate type and method are strings
    IF NOT (
      jsonb_typeof(payment->'type') = 'string' AND
      jsonb_typeof(payment->'method') = 'string'
    ) THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

-- Function to validate payment details structure
CREATE OR REPLACE FUNCTION validate_payment_details(payment_details jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check required fields exist
  IF NOT (
    payment_details ? 'total_amount' AND 
    payment_details ? 'paid_amount' AND 
    payment_details ? 'pending_amount' AND 
    payment_details ? 'payment_status' AND 
    payment_details ? 'payments'
  ) THEN
    RAISE EXCEPTION 'Invalid payment details structure: missing required fields';
  END IF;

  -- Validate amounts are numbers
  IF NOT (
    jsonb_typeof(payment_details->'total_amount') IN ('number', 'string') AND
    jsonb_typeof(payment_details->'paid_amount') IN ('number', 'string') AND
    jsonb_typeof(payment_details->'pending_amount') IN ('number', 'string')
  ) THEN
    RAISE EXCEPTION 'Payment amounts must be numbers';
  END IF;

  -- Validate status is string
  IF NOT jsonb_typeof(payment_details->'payment_status') = 'string' THEN
    RAISE EXCEPTION 'Payment status must be a string';
  END IF;

  -- Validate status is one of the allowed values
  IF NOT (payment_details->>'payment_status' = ANY (ARRAY['pending', 'partial', 'completed', 'failed'])) THEN
    RAISE EXCEPTION 'Invalid payment status value';
  END IF;

  -- Validate payments array
  IF NOT validate_payment_array(payment_details->'payments') THEN
    RAISE EXCEPTION 'Invalid payments array structure';
  END IF;

  -- Validate amount consistency
  DECLARE
    v_total numeric;
    v_paid numeric;
    v_pending numeric;
  BEGIN
    v_total := (payment_details->>'total_amount')::numeric;
    v_paid := (payment_details->>'paid_amount')::numeric;
    v_pending := (payment_details->>'pending_amount')::numeric;

    IF v_total < 0 OR v_paid < 0 OR v_pending < 0 THEN
      RAISE EXCEPTION 'Payment amounts cannot be negative';
    END IF;

    IF abs(v_total - (v_paid + v_pending)) > 0.01 THEN
      RAISE EXCEPTION 'Payment amounts do not reconcile (total ≠ paid + pending)';
    END IF;
  END;

  RETURN true;
END;
$$;

-- Trigger function for quotations
CREATE OR REPLACE FUNCTION validate_quotation_payment_details()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Skip validation if payment_details is null
  IF NEW.payment_details IS NULL THEN
    RETURN NEW;
  END IF;

  -- Validate payment details structure
  IF NOT validate_payment_details(NEW.payment_details) THEN
    RAISE EXCEPTION 'Invalid payment details structure';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on quotations table
CREATE TRIGGER validate_payment_details_trigger
  BEFORE INSERT OR UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION validate_quotation_payment_details();

-- Add comment explaining the validation
COMMENT ON FUNCTION validate_payment_array(jsonb) IS 'Validates the structure and data types of a payment array';
COMMENT ON FUNCTION validate_payment_details(jsonb) IS 'Validates the complete payment details structure including amounts and status';
COMMENT ON FUNCTION validate_quotation_payment_details() IS 'Trigger function to validate payment details before quotation insert/update';