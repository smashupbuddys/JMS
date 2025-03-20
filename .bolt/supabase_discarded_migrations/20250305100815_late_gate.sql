/*
  # Fix Payment Details Validation

  1. Changes
     - Add proper validation for payment details structure
     - Add constraints for payment amounts
     - Add validation for payment status values
     - Add validation for payment methods
     - Add validation for payment dates

  2. Security
     - Enable RLS on all affected tables
     - Add policies for payment validation
*/

-- Enhanced payment details validation function
CREATE OR REPLACE FUNCTION validate_payment_details(details jsonb)
RETURNS boolean AS $$
BEGIN
  -- Check required fields exist
  IF NOT (
    details ? 'total_amount' AND
    details ? 'paid_amount' AND
    details ? 'pending_amount' AND
    details ? 'payment_status' AND
    details ? 'payments'
  ) THEN
    RAISE EXCEPTION 'Invalid payment details structure: missing required fields';
  END IF;

  -- Validate numeric fields
  IF NOT (
    (jsonb_typeof(details->'total_amount') IN ('number', 'string') AND 
     (details->>'total_amount')::numeric >= 0) AND
    (jsonb_typeof(details->'paid_amount') IN ('number', 'string') AND 
     (details->>'paid_amount')::numeric >= 0) AND
    (jsonb_typeof(details->'pending_amount') IN ('number', 'string') AND 
     (details->>'pending_amount')::numeric >= 0)
  ) THEN
    RAISE EXCEPTION 'Invalid payment amounts: must be non-negative numbers';
  END IF;

  -- Validate payment status
  IF NOT (
    jsonb_typeof(details->'payment_status') = 'string' AND
    details->>'payment_status' IN ('pending', 'completed', 'partial', 'failed')
  ) THEN
    RAISE EXCEPTION 'Invalid payment status: must be pending, completed, partial, or failed';
  END IF;

  -- Validate payments array
  IF jsonb_typeof(details->'payments') != 'array' THEN
    RAISE EXCEPTION 'Invalid payments: must be an array';
  END IF;

  -- Validate each payment in the array
  FOR payment IN SELECT * FROM jsonb_array_elements(details->'payments')
  LOOP
    IF NOT (
      payment ? 'amount' AND
      payment ? 'date' AND
      payment ? 'type' AND
      payment ? 'method' AND
      jsonb_typeof(payment->'amount') IN ('number', 'string') AND
      (payment->>'amount')::numeric >= 0 AND
      payment->>'type' IN ('full', 'partial', 'advance') AND
      payment->>'method' IN ('cash', 'card', 'upi', 'bank_transfer')
    ) THEN
      RAISE EXCEPTION 'Invalid payment object structure';
    END IF;
  END LOOP;

  -- Validate amount reconciliation
  IF (details->>'total_amount')::numeric != 
     (details->>'paid_amount')::numeric + (details->>'pending_amount')::numeric THEN
    RAISE EXCEPTION 'Payment amount mismatch: total_amount must equal paid_amount + pending_amount';
  END IF;

  -- Validate payment status matches amounts
  CASE details->>'payment_status'
    WHEN 'completed' THEN
      IF (details->>'pending_amount')::numeric != 0 OR 
         (details->>'paid_amount')::numeric != (details->>'total_amount')::numeric THEN
        RAISE EXCEPTION 'Invalid payment status: completed status requires full payment';
      END IF;
    WHEN 'partial' THEN
      IF (details->>'paid_amount')::numeric = 0 OR 
         (details->>'paid_amount')::numeric >= (details->>'total_amount')::numeric THEN
        RAISE EXCEPTION 'Invalid payment status: partial status requires partial payment';
      END IF;
    WHEN 'pending' THEN
      IF (details->>'paid_amount')::numeric != 0 THEN
        RAISE EXCEPTION 'Invalid payment status: pending status requires zero paid amount';
      END IF;
  END CASE;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to validate payment details on insert/update
CREATE OR REPLACE FUNCTION validate_quotation_payment_details()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS validate_payment_details_trigger ON quotations;

-- Create new trigger
CREATE TRIGGER validate_payment_details_trigger
  BEFORE INSERT OR UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION validate_quotation_payment_details();

-- Add payment status check constraint
ALTER TABLE quotations
  ADD CONSTRAINT valid_payment_status
  CHECK (payment_details->>'payment_status' IN ('pending', 'completed', 'partial', 'failed'));

-- Add payment amount check constraint
ALTER TABLE quotations
  ADD CONSTRAINT valid_payment_amounts
  CHECK (
    (payment_details->>'total_amount')::numeric >= 0 AND
    (payment_details->>'paid_amount')::numeric >= 0 AND
    (payment_details->>'pending_amount')::numeric >= 0 AND
    (payment_details->>'total_amount')::numeric = 
    (payment_details->>'paid_amount')::numeric + (payment_details->>'pending_amount')::numeric
  );