/*
  # Fix deleted quotations functionality

  1. New Tables
    - `deleted_quotations` - Stores deleted quotations with full history
  
  2. Changes
    - Add trigger to automatically move deleted quotations
    - Add restore functionality
    - Add RLS policies and indexes
    
  3. Security
    - Enable RLS
    - Add policies for staff access
*/

-- Create deleted_quotations table if not exists
CREATE TABLE IF NOT EXISTS deleted_quotations (
  id uuid PRIMARY KEY,
  quotation_number text NOT NULL,
  customer_id uuid REFERENCES customers(id),
  video_call_id uuid REFERENCES video_calls(id),
  items jsonb NOT NULL,
  total_amount numeric NOT NULL,
  status text NOT NULL,
  payment_details jsonb,
  workflow_status jsonb,
  valid_until timestamptz,
  bill_status text,
  bill_generated_at timestamptz,
  bill_paid_at timestamptz,
  created_at timestamptz NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by uuid REFERENCES staff(id),
  deletion_reason text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE deleted_quotations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Staff can view deleted quotations"
  ON deleted_quotations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert deleted quotations"
  ON deleted_quotations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can delete deleted quotations"
  ON deleted_quotations
  FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger function to move quotations to deleted_quotations
CREATE OR REPLACE FUNCTION move_quotation_to_deleted()
RETURNS trigger AS $$
BEGIN
  -- Insert the deleted quotation into deleted_quotations
  INSERT INTO deleted_quotations (
    id,
    quotation_number,
    customer_id,
    video_call_id,
    items,
    total_amount,
    status,
    payment_details,
    workflow_status,
    valid_until,
    bill_status,
    bill_generated_at,
    bill_paid_at,
    created_at,
    deleted_by,
    metadata
  )
  VALUES (
    OLD.id,
    OLD.quotation_number,
    OLD.customer_id,
    OLD.video_call_id,
    OLD.items,
    OLD.total_amount,
    OLD.status,
    OLD.payment_details,
    OLD.workflow_status,
    OLD.valid_until,
    OLD.bill_status,
    OLD.bill_generated_at,
    OLD.bill_paid_at,
    OLD.created_at,
    auth.uid(),
    jsonb_build_object(
      'deleted_from_ip', inet_client_addr(),
      'deleted_from_app', current_setting('app.name', true),
      'original_data', to_jsonb(OLD)
    )
  );
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS quotation_deleted ON quotations;
CREATE TRIGGER quotation_deleted
  BEFORE DELETE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION move_quotation_to_deleted();

-- Function to restore deleted quotation
CREATE OR REPLACE FUNCTION restore_deleted_quotation(p_quotation_id uuid)
RETURNS uuid AS $$
DECLARE
  v_quotation deleted_quotations%ROWTYPE;
  v_new_id uuid;
BEGIN
  -- Get deleted quotation
  SELECT * INTO v_quotation
  FROM deleted_quotations
  WHERE id = p_quotation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deleted quotation not found';
  END IF;

  -- Insert back into quotations
  INSERT INTO quotations (
    quotation_number,
    customer_id,
    video_call_id,
    items,
    total_amount,
    status,
    payment_details,
    workflow_status,
    valid_until,
    bill_status,
    bill_generated_at,
    bill_paid_at,
    created_at
  ) VALUES (
    v_quotation.quotation_number,
    v_quotation.customer_id,
    v_quotation.video_call_id,
    v_quotation.items,
    v_quotation.total_amount,
    v_quotation.status,
    v_quotation.payment_details,
    v_quotation.workflow_status,
    v_quotation.valid_until,
    v_quotation.bill_status,
    v_quotation.bill_generated_at,
    v_quotation.bill_paid_at,
    v_quotation.created_at
  )
  RETURNING id INTO v_new_id;

  -- Delete from deleted_quotations
  DELETE FROM deleted_quotations
  WHERE id = p_quotation_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_deleted_quotations_deleted_at 
  ON deleted_quotations(deleted_at);
CREATE INDEX IF NOT EXISTS idx_deleted_quotations_quotation_number 
  ON deleted_quotations(quotation_number);
CREATE INDEX IF NOT EXISTS idx_deleted_quotations_customer_id 
  ON deleted_quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_deleted_quotations_created_at 
  ON deleted_quotations(created_at);