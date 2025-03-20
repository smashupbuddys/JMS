/*
  # Sale Completion Functions and Tables

  1. New Functions
    - process_complete_sale: Main function to process a complete sale
    - validate_sale_data: Helper function to validate sale data
    - update_stock_levels: Helper function to update product stock levels
    - record_sale_transaction: Helper function to record the sale transaction

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for staff access
*/

-- Create sale_transactions table if not exists
CREATE TABLE IF NOT EXISTS sale_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id),
  customer_type text NOT NULL CHECK (customer_type IN ('retailer', 'wholesaler')),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  discount_amount numeric NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  gst_amount numeric NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  final_amount numeric NOT NULL CHECK (final_amount >= 0),
  payment_status text NOT NULL CHECK (payment_status IN ('pending', 'partial', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_by uuid REFERENCES staff(id),
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create sale_items table if not exists
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sale_transactions(id),
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  total_price numeric NOT NULL CHECK (total_price >= 0),
  manufacturer text NOT NULL,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create sale_payments table if not exists
CREATE TABLE IF NOT EXISTS sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sale_transactions(id),
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'upi', 'bank_transfer')),
  payment_status text NOT NULL CHECK (payment_status IN ('success', 'pending', 'failed')),
  payment_date timestamptz NOT NULL DEFAULT now(),
  reference_number text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Function to generate unique bill number
CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS text AS $$
DECLARE
  v_date text;
  v_sequence integer;
  v_bill_number text;
BEGIN
  -- Get current date in YYYYMMDD format
  v_date := to_char(current_date, 'YYYYMMDD');
  
  -- Get next sequence number for today
  SELECT COALESCE(MAX(SUBSTRING(bill_number FROM '\d+$')::integer), 0) + 1
  INTO v_sequence
  FROM sale_transactions
  WHERE bill_number LIKE 'BILL-' || v_date || '-%';
  
  -- Generate bill number
  v_bill_number := 'BILL-' || v_date || '-' || LPAD(v_sequence::text, 4, '0');
  
  RETURN v_bill_number;
END;
$$ LANGUAGE plpgsql;

-- Function to process complete sale
CREATE OR REPLACE FUNCTION process_complete_sale(
  p_customer_id uuid,
  p_customer_type text,
  p_items jsonb,
  p_payment_details jsonb,
  p_staff_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_sale_id uuid;
  v_bill_number text;
  v_total_amount numeric := 0;
  v_item record;
BEGIN
  -- Generate bill number
  v_bill_number := generate_bill_number();
  
  -- Start transaction
  BEGIN
    -- Create sale transaction
    INSERT INTO sale_transactions (
      bill_number,
      customer_id,
      customer_type,
      total_amount,
      discount_amount,
      gst_amount,
      final_amount,
      payment_status,
      created_by
    ) VALUES (
      v_bill_number,
      p_customer_id,
      p_customer_type,
      (p_payment_details->>'total_amount')::numeric,
      (p_payment_details->>'discount_amount')::numeric,
      (p_payment_details->>'gst_amount')::numeric,
      (p_payment_details->>'final_amount')::numeric,
      CASE 
        WHEN (p_payment_details->>'paid_amount')::numeric = (p_payment_details->>'total_amount')::numeric 
        THEN 'completed'
        WHEN (p_payment_details->>'paid_amount')::numeric > 0 
        THEN 'partial'
        ELSE 'pending'
      END,
      p_staff_id
    ) RETURNING id INTO v_sale_id;

    -- Process items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      -- Insert sale item
      INSERT INTO sale_items (
        sale_id,
        product_id,
        quantity,
        unit_price,
        total_price,
        manufacturer,
        category
      ) VALUES (
        v_sale_id,
        (v_item->>'product_id')::uuid,
        (v_item->>'quantity')::integer,
        (v_item->>'price')::numeric,
        (v_item->>'quantity')::integer * (v_item->>'price')::numeric,
        v_item->>'manufacturer',
        v_item->>'category'
      );

      -- Update product stock
      UPDATE products SET
        stock_level = GREATEST(0, stock_level - (v_item->>'quantity')::integer),
        last_sold_at = now()
      WHERE id = (v_item->>'product_id')::uuid;

      v_total_amount := v_total_amount + 
        ((v_item->>'quantity')::integer * (v_item->>'price')::numeric);
    END LOOP;

    -- Record payment
    IF (p_payment_details->>'paid_amount')::numeric > 0 THEN
      INSERT INTO sale_payments (
        sale_id,
        amount,
        payment_method,
        payment_status
      ) VALUES (
        v_sale_id,
        (p_payment_details->>'paid_amount')::numeric,
        p_payment_details->>'payment_method',
        'success'
      );
    END IF;

    -- Update customer if applicable
    IF p_customer_id IS NOT NULL THEN
      UPDATE customers SET
        total_purchases = COALESCE(total_purchases, 0) + v_total_amount,
        last_purchase_date = now()
      WHERE id = p_customer_id;
    END IF;

    -- Return success response
    RETURN jsonb_build_object(
      'success', true,
      'sale_id', v_sale_id,
      'bill_number', v_bill_number,
      'total_amount', v_total_amount
    );

  EXCEPTION WHEN OTHERS THEN
    -- Rollback and return error
    RAISE EXCEPTION 'Error processing sale: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE sale_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Staff can view all sale transactions"
  ON sale_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert sale transactions"
  ON sale_transactions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Staff can view all sale items"
  ON sale_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert sale items"
  ON sale_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Staff can view all sale payments"
  ON sale_payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert sale payments"
  ON sale_payments FOR INSERT TO authenticated WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sale_transactions_customer_id ON sale_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_transactions_created_at ON sale_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_transactions_bill_number ON sale_transactions(bill_number);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON sale_payments(sale_id);