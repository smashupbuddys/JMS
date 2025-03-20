/*
  # Billing System Schema

  1. New Tables
    - `billing_settings`
      - Stores global billing configuration
      - Tax rates, minimum order amounts, payment terms
    - `pricing_tiers`
      - Defines wholesale pricing tiers
      - Volume-based discounts
    - `credit_limits`
      - Manages wholesale customer credit limits
      - Credit history and payment terms
    - `sales_transactions`
      - Records all sales transactions
      - Common table for both retail and wholesale
    - `transaction_items`
      - Individual items in each transaction
      - Links to products with pricing details
    - `payment_terms`
      - Configurable payment terms
      - Different for wholesale/retail

  2. Security
    - Enable RLS on all tables
    - Add policies for staff access
    - Protect sensitive pricing data

  3. Changes
    - Add credit limit fields to customers table
    - Add pricing tier fields to products table
*/

-- Billing Settings Table
CREATE TABLE IF NOT EXISTS billing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default billing settings
INSERT INTO billing_settings (setting_key, setting_value) VALUES
('retail_settings', jsonb_build_object(
  'default_tax_rate', 18,
  'min_order_amount', 0,
  'payment_terms', 'immediate',
  'allow_discounts', true,
  'max_discount_percent', 10
)),
('wholesale_settings', jsonb_build_object(
  'default_tax_rate', 18,
  'min_order_amount', 50000,
  'default_payment_terms', 'net_30',
  'volume_discount_enabled', true,
  'credit_check_required', true
));

-- Pricing Tiers Table
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('wholesale', 'retail')),
  min_quantity integer NOT NULL,
  max_quantity integer,
  discount_percent numeric NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default pricing tiers
INSERT INTO pricing_tiers (name, type, min_quantity, max_quantity, discount_percent) VALUES
('Retail Standard', 'retail', 1, NULL, 0),
('Wholesale Bronze', 'wholesale', 100, 499, 5),
('Wholesale Silver', 'wholesale', 500, 999, 10),
('Wholesale Gold', 'wholesale', 1000, NULL, 15);

-- Credit Limits Table
CREATE TABLE IF NOT EXISTS credit_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  credit_limit numeric NOT NULL DEFAULT 0,
  available_credit numeric NOT NULL DEFAULT 0,
  payment_terms text NOT NULL DEFAULT 'net_30',
  last_review_date timestamptz DEFAULT now(),
  next_review_date timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'review_required')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (customer_id)
);

-- Sales Transactions Table
CREATE TABLE IF NOT EXISTS sales_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES customers(id),
  sale_type text NOT NULL CHECK (type IN ('wholesale', 'retail', 'counter')),
  subtotal numeric NOT NULL CHECK (subtotal >= 0),
  discount_amount numeric NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount numeric NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'completed', 'overdue')),
  payment_due_date timestamptz,
  payment_terms text,
  notes text,
  created_by uuid REFERENCES staff(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Transaction Items Table
CREATE TABLE IF NOT EXISTS transaction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES sales_transactions(id),
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  discount_percent numeric NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  tax_percent numeric NOT NULL DEFAULT 0 CHECK (tax_percent >= 0),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  created_at timestamptz DEFAULT now()
);

-- Payment Terms Table
CREATE TABLE IF NOT EXISTS payment_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  days integer NOT NULL,
  description text,
  interest_rate numeric DEFAULT 0 CHECK (interest_rate >= 0),
  early_payment_discount numeric DEFAULT 0 CHECK (early_payment_discount >= 0),
  late_payment_fee numeric DEFAULT 0 CHECK (late_payment_fee >= 0),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default payment terms
INSERT INTO payment_terms (name, days, description) VALUES
('Immediate', 0, 'Payment due immediately'),
('Net 15', 15, 'Payment due within 15 days'),
('Net 30', 30, 'Payment due within 30 days'),
('Net 60', 60, 'Payment due within 60 days');

-- Add credit limit fields to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit numeric DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS available_credit numeric DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_terms text REFERENCES payment_terms(name);

-- Add pricing tier fields to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_min_quantity integer DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pricing_tier_id uuid REFERENCES pricing_tiers(id);

-- Enable RLS
ALTER TABLE billing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_terms ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Staff can view billing settings"
  ON billing_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage billing settings"
  ON billing_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Staff can view pricing tiers"
  ON pricing_tiers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage pricing tiers"
  ON pricing_tiers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Staff can view credit limits"
  ON credit_limits FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and managers can manage credit limits"
  ON credit_limits FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Staff can view sales transactions"
  ON sales_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can create and update sales transactions"
  ON sales_transactions FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Staff can view transaction items"
  ON transaction_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can create transaction items"
  ON transaction_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can view payment terms"
  ON payment_terms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage payment terms"
  ON payment_terms FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Functions for billing operations
CREATE OR REPLACE FUNCTION calculate_volume_discount(
  p_quantity integer,
  p_unit_price numeric,
  p_customer_type text
) RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_discount_percent numeric;
BEGIN
  -- Get applicable discount based on quantity and customer type
  SELECT discount_percent INTO v_discount_percent
  FROM pricing_tiers
  WHERE type = p_customer_type
    AND min_quantity <= p_quantity
    AND (max_quantity IS NULL OR max_quantity >= p_quantity)
    AND active = true
  ORDER BY min_quantity DESC
  LIMIT 1;

  -- Return discounted price
  RETURN p_unit_price * (1 - COALESCE(v_discount_percent, 0) / 100);
END;
$$;

-- Function to check credit limit
CREATE OR REPLACE FUNCTION check_credit_limit(
  p_customer_id uuid,
  p_amount numeric
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_available_credit numeric;
BEGIN
  -- Get customer's available credit
  SELECT available_credit INTO v_available_credit
  FROM credit_limits
  WHERE customer_id = p_customer_id
    AND status = 'active';

  -- Return true if credit is available or customer has no credit limit
  RETURN COALESCE(v_available_credit, 0) >= p_amount OR v_available_credit IS NULL;
END;
$$;

-- Function to update credit limit after sale
CREATE OR REPLACE FUNCTION update_credit_limit_after_sale()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only process wholesale transactions
  IF NEW.sale_type = 'wholesale' THEN
    -- Update available credit
    UPDATE credit_limits
    SET available_credit = available_credit - NEW.total_amount
    WHERE customer_id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for credit limit updates
CREATE TRIGGER tr_update_credit_limit_after_sale
  AFTER INSERT ON sales_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_credit_limit_after_sale();

-- Function to generate transaction number
CREATE OR REPLACE FUNCTION generate_transaction_number(
  p_sale_type text
) RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix text;
  v_sequence integer;
  v_date text;
BEGIN
  -- Set prefix based on sale type
  v_prefix := CASE 
    WHEN p_sale_type = 'wholesale' THEN 'WS'
    WHEN p_sale_type = 'retail' THEN 'RT'
    ELSE 'CS'
  END;
  
  -- Get current date in YYYYMMDD format
  v_date := to_char(current_date, 'YYYYMMDD');
  
  -- Get next sequence number
  SELECT COALESCE(MAX(SUBSTRING(transaction_number FROM '\d+')::integer), 0) + 1
  INTO v_sequence
  FROM sales_transactions
  WHERE transaction_number LIKE v_prefix || v_date || '%';
  
  -- Return formatted transaction number
  RETURN v_prefix || v_date || LPAD(v_sequence::text, 4, '0');
END;
$$;

-- Function to validate minimum order quantity
CREATE OR REPLACE FUNCTION validate_minimum_order_quantity(
  p_product_id uuid,
  p_quantity integer,
  p_customer_type text
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_min_quantity integer;
BEGIN
  -- Get minimum quantity for the product
  SELECT CASE 
    WHEN p_customer_type = 'wholesale' THEN wholesale_min_quantity
    ELSE 1
  END INTO v_min_quantity
  FROM products
  WHERE id = p_product_id;
  
  -- Return true if quantity meets minimum requirement
  RETURN p_quantity >= COALESCE(v_min_quantity, 1);
END;
$$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_transactions_customer_id ON sales_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_created_at ON sales_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_credit_limits_customer_id ON credit_limits(customer_id);
CREATE INDEX IF NOT EXISTS idx_pricing_tiers_type_quantity ON pricing_tiers(type, min_quantity, max_quantity);