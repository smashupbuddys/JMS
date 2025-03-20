/*
  # Quotation Management Schema

  1. New Tables
    - `quotations`: Stores quotation details and status
    - `quotation_items`: Stores items in each quotation
    - `quotation_history`: Tracks quotation changes and updates
    
  2. Security
    - Enable RLS on all tables
    - Add policies for CRUD operations
*/

-- Create quotations table
CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES customers(id),
  video_call_id uuid REFERENCES video_calls(id),
  items jsonb NOT NULL DEFAULT '[]',
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  payment_details jsonb,
  transaction_details jsonb,
  workflow_status jsonb,
  valid_until timestamptz,
  bill_status text DEFAULT 'pending',
  bill_generated_at timestamptz,
  bill_sent_at timestamptz,
  bill_paid_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create quotation history table
CREATE TABLE IF NOT EXISTS quotation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid REFERENCES quotations(id) ON DELETE CASCADE,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid REFERENCES staff(id),
  changed_at timestamptz DEFAULT now()
);

-- Create quotation items table
CREATE TABLE IF NOT EXISTS quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid REFERENCES quotations(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  quantity integer NOT NULL DEFAULT 1,
  price numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

-- Policies for quotations
CREATE POLICY "Staff can view quotations"
  ON quotations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can create quotations"
  ON quotations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can update quotations"
  ON quotations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for quotation history
CREATE POLICY "Staff can view quotation history"
  ON quotation_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can create quotation history"
  ON quotation_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policies for quotation items
CREATE POLICY "Staff can view quotation items"
  ON quotation_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can create quotation items"
  ON quotation_items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to update quotation total
CREATE OR REPLACE FUNCTION update_quotation_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE quotations
  SET total_amount = (
    SELECT COALESCE(SUM(quantity * price), 0)
    FROM quotation_items
    WHERE quotation_id = NEW.quotation_id
  )
  WHERE id = NEW.quotation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update quotation total when items change
CREATE TRIGGER update_quotation_total_trigger
AFTER INSERT OR UPDATE OR DELETE ON quotation_items
FOR EACH ROW
EXECUTE FUNCTION update_quotation_total();

-- Function to track quotation history
CREATE OR REPLACE FUNCTION track_quotation_history()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    INSERT INTO quotation_history (
      quotation_id,
      action,
      old_data,
      new_data,
      changed_by
    ) VALUES (
      NEW.id,
      'update',
      row_to_json(OLD),
      row_to_json(NEW),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track quotation history
CREATE TRIGGER track_quotation_history_trigger
AFTER UPDATE ON quotations
FOR EACH ROW
EXECUTE FUNCTION track_quotation_history();