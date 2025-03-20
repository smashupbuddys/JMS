/*
  # Sales System Setup

  1. New Tables
    - sales_transactions
    - sale_items
    - sale_payments
    - sale_history

  2. Security
    - Enable RLS
    - Create policies
    
  3. Functions
    - Process sales
    - Update inventory
    - Handle payments
*/

-- Create sales_transactions table
CREATE TABLE IF NOT EXISTS sales_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text UNIQUE NOT NULL,
  sale_type text NOT NULL CHECK (sale_type IN ('counter', 'video_call')),
  customer_id uuid REFERENCES customers(id),
  video_call_id uuid REFERENCES video_calls(id),
  quotation_id uuid REFERENCES quotations(id),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  discount_amount numeric NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  gst_amount numeric NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  final_amount numeric NOT NULL CHECK (final_amount >= 0),
  payment_status text NOT NULL CHECK (payment_status IN ('completed', 'partial', 'pending')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_by uuid REFERENCES staff(id),
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create sale_items table
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales_transactions(id),
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  total_price numeric NOT NULL CHECK (total_price >= 0),
  manufacturer text NOT NULL,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create sale_payments table
CREATE TABLE IF NOT EXISTS sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales_transactions(id),
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'card', 'upi', 'bank_transfer')),
  payment_status text NOT NULL CHECK (payment_status IN ('completed', 'pending', 'failed')),
  payment_date timestamptz NOT NULL DEFAULT now(),
  reference_number text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create sale_history table for audit trail
CREATE TABLE IF NOT EXISTS sale_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales_transactions(id),
  event_type text NOT NULL,
  event_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES staff(id)
);

-- Enable RLS
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Staff can view all sales"
  ON sales_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert sales"
  ON sales_transactions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Staff can view sale items"
  ON sale_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert sale items"
  ON sale_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Staff can view payments"
  ON sale_payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert payments"
  ON sale_payments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Staff can view history"
  ON sale_history FOR SELECT TO authenticated USING (true);

-- Function to generate unique sale number
CREATE OR REPLACE FUNCTION generate_sale_number()
RETURNS text AS $$
DECLARE
  v_date text;
  v_sequence integer;
  v_sale_number text;
BEGIN
  -- Get current date in YYYYMMDD format
  v_date := to_char(current_date, 'YYYYMMDD');
  
  -- Get next sequence number for today
  SELECT COALESCE(MAX(SUBSTRING(sale_number FROM '\d+$')::integer), 0) + 1
  INTO v_sequence
  FROM sales_transactions
  WHERE sale_number LIKE 'SALE-' || v_date || '-%';
  
  -- Generate sale number
  v_sale_number := 'SALE-' || v_date || '-' || LPAD(v_sequence::text, 4, '0');
  
  RETURN v_sale_number;
END;
$$ LANGUAGE plpgsql;

-- Function to process sale
CREATE OR REPLACE FUNCTION process_sale(
  p_sale_type text,
  p_customer_id uuid,
  p_video_call_id uuid,
  p_quotation_id uuid,
  p_items jsonb,
  p_payment_details jsonb,
  p_staff_id uuid
)
RETURNS uuid AS $$
DECLARE
  v_sale_id uuid;
  v_sale_number text;
  v_total_amount numeric := 0;
  v_item record;
  v_payment record;
BEGIN
  -- Generate sale number
  v_sale_number := generate_sale_number();
  
  -- Calculate total amount
  SELECT SUM((item->>'quantity')::integer * (item->>'price')::numeric)
  INTO v_total_amount
  FROM jsonb_array_elements(p_items) item;

  -- Create sale transaction
  INSERT INTO sales_transactions (
    sale_number,
    sale_type,
    customer_id,
    video_call_id,
    quotation_id,
    total_amount,
    discount_amount,
    gst_amount,
    final_amount,
    payment_status,
    created_by
  ) VALUES (
    v_sale_number,
    p_sale_type,
    p_customer_id,
    p_video_call_id,
    p_quotation_id,
    v_total_amount,
    (p_payment_details->>'discount_amount')::numeric,
    (p_payment_details->>'gst_amount')::numeric,
    (p_payment_details->>'final_amount')::numeric,
    p_payment_details->>'payment_status',
    p_staff_id
  ) RETURNING id INTO v_sale_id;

  -- Insert sale items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
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
  END LOOP;

  -- Insert payments if any
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payment_details->'payments')
  LOOP
    INSERT INTO sale_payments (
      sale_id,
      amount,
      payment_method,
      payment_status,
      payment_date,
      reference_number
    ) VALUES (
      v_sale_id,
      (v_payment->>'amount')::numeric,
      v_payment->>'method',
      'completed',
      (v_payment->>'date')::timestamptz,
      v_payment->>'reference_number'
    );
  END LOOP;

  -- Update customer if applicable
  IF p_customer_id IS NOT NULL THEN
    UPDATE customers SET
      total_purchases = COALESCE(total_purchases, 0) + v_total_amount,
      last_purchase_date = now()
    WHERE id = p_customer_id;
  END IF;

  -- Log sale creation
  INSERT INTO sale_history (
    sale_id,
    event_type,
    event_data,
    created_by
  ) VALUES (
    v_sale_id,
    'sale_created',
    jsonb_build_object(
      'sale_number', v_sale_number,
      'total_amount', v_total_amount,
      'payment_status', p_payment_details->>'payment_status'
    ),
    p_staff_id
  );

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

-- Create indexes
CREATE INDEX idx_sales_transactions_customer_id ON sales_transactions(customer_id);
CREATE INDEX idx_sales_transactions_created_at ON sales_transactions(created_at);
CREATE INDEX idx_sales_transactions_sale_number ON sales_transactions(sale_number);
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX idx_sale_payments_sale_id ON sale_payments(sale_id);
CREATE INDEX idx_sale_history_sale_id ON sale_history(sale_id);
CREATE INDEX idx_sale_history_created_at ON sale_history(created_at);