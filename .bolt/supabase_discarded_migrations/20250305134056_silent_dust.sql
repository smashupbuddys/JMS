-- Drop existing payment validation functions
DROP FUNCTION IF EXISTS validate_payment_details CASCADE;
DROP FUNCTION IF EXISTS validate_payment_array CASCADE;

-- Create function to validate payment array
CREATE OR REPLACE FUNCTION validate_payment_array(payments jsonb)
RETURNS boolean AS $$
BEGIN
  -- Check if payments is an array
  IF NOT jsonb_typeof(payments) = 'array' THEN
    RETURN false;
  END IF;

  -- Check each payment object structure
  FOR payment IN SELECT * FROM jsonb_array_elements(payments) LOOP
    IF NOT (
      payment ? 'amount' AND 
      payment ? 'date' AND 
      payment ? 'type' AND 
      payment ? 'method' AND
      (jsonb_typeof(payment->'amount') = 'number' OR 
       (jsonb_typeof(payment->'amount') = 'string' AND 
        payment->>'amount' ~ '^[0-9]+\.?[0-9]*$')) AND
      payment->>'type' IN ('full', 'partial', 'advance') AND
      payment->>'method' IN ('cash', 'card', 'upi', 'bank_transfer')
    ) THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Create enhanced payment details validation function
CREATE OR REPLACE FUNCTION validate_payment_details(details jsonb)
RETURNS boolean AS $$
DECLARE
  v_total_amount numeric;
  v_paid_amount numeric;
  v_pending_amount numeric;
  v_payment_status text;
BEGIN
  -- Check required fields exist
  IF NOT (
    details ? 'total_amount' AND 
    details ? 'paid_amount' AND 
    details ? 'pending_amount' AND 
    details ? 'payment_status' AND 
    details ? 'payments'
  ) THEN
    RAISE EXCEPTION 'Missing required payment fields';
  END IF;

  -- Parse and validate amounts
  BEGIN
    v_total_amount := (details->>'total_amount')::numeric;
    v_paid_amount := (details->>'paid_amount')::numeric;
    v_pending_amount := (details->>'pending_amount')::numeric;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid numeric values in payment amounts';
  END;

  -- Get payment status
  v_payment_status := details->>'payment_status';

  -- Validate numeric values
  IF v_total_amount < 0 OR v_paid_amount < 0 OR v_pending_amount < 0 THEN
    RAISE EXCEPTION 'Payment amounts cannot be negative';
  END IF;

  -- Validate payment status
  IF NOT v_payment_status = ANY(ARRAY['pending', 'partial', 'completed']) THEN
    RAISE EXCEPTION 'Invalid payment status: %', v_payment_status;
  END IF;

  -- Validate amount reconciliation with small tolerance for floating point errors
  IF abs((v_paid_amount + v_pending_amount) - v_total_amount) > 0.01 THEN
    RAISE EXCEPTION 'Payment amounts do not reconcile: total=%, paid=%, pending=%',
      v_total_amount, v_paid_amount, v_pending_amount;
  END IF;

  -- Validate payments array
  IF NOT validate_payment_array(details->'payments') THEN
    RAISE EXCEPTION 'Invalid payments array structure';
  END IF;

  -- Validate payment status matches amounts
  CASE v_payment_status
    WHEN 'completed' THEN
      IF v_pending_amount > 0 OR abs(v_paid_amount - v_total_amount) > 0.01 THEN
        RAISE EXCEPTION 'Completed status requires full payment';
      END IF;
    WHEN 'partial' THEN
      IF v_paid_amount <= 0 OR v_paid_amount >= v_total_amount THEN
        RAISE EXCEPTION 'Partial status requires partial payment';
      END IF;
    WHEN 'pending' THEN
      IF v_paid_amount > 0 THEN
        RAISE EXCEPTION 'Pending status requires zero paid amount';
      END IF;
  END CASE;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function
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

-- Create or replace trigger
DROP TRIGGER IF EXISTS validate_payment_details_trigger ON quotations;
CREATE TRIGGER validate_payment_details_trigger
  BEFORE INSERT OR UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION validate_quotation_payment_details();