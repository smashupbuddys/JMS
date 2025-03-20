/*
  # Deleted Quotations Management System

  1. New Table
    - deleted_quotations
      - Stores deleted quotations with full history
      - Tracks deletion metadata
      - Maintains customer relationships

  2. Triggers
    - quotation_soft_delete_trigger
      - Moves deleted quotations to archive table
      - Preserves all related data
*/

-- Create deleted quotations table
CREATE TABLE IF NOT EXISTS deleted_quotations (
  id uuid PRIMARY KEY,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  video_call_id uuid,
  items jsonb NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  status varchar,
  valid_until timestamptz,
  quotation_number varchar,
  delivery_method varchar,
  buyer_name varchar,
  buyer_phone varchar,
  payment_details jsonb,
  workflow_status jsonb,
  payment_timeline jsonb[] DEFAULT ARRAY[]::jsonb[],
  staff_responses jsonb[] DEFAULT ARRAY[]::jsonb[],
  payment_notes jsonb[] DEFAULT ARRAY[]::jsonb[],
  next_follow_up jsonb,
  payment_reminders jsonb[] DEFAULT ARRAY[]::jsonb[],
  staff_follow_ups jsonb[] DEFAULT ARRAY[]::jsonb[],
  bill_status varchar,
  bill_generated_at timestamptz,
  bill_sent_at timestamptz,
  bill_paid_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz DEFAULT now(),
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deletion_reason text,
  customers jsonb -- Denormalized customer data at time of deletion
);

-- Enable RLS
ALTER TABLE deleted_quotations ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access only
CREATE POLICY "Only admins can access deleted quotations" ON deleted_quotations
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM staff 
      WHERE role = 'admin' 
      AND active = true
    )
  );

-- Create function to handle quotation deletion
CREATE OR REPLACE FUNCTION handle_quotation_deletion()
RETURNS TRIGGER AS $$
DECLARE
  customer_data jsonb;
BEGIN
  -- Get customer data
  SELECT row_to_json(c)::jsonb INTO customer_data
  FROM customers c
  WHERE c.id = OLD.customer_id;

  -- Insert into deleted_quotations
  INSERT INTO deleted_quotations (
    id,
    customer_id,
    video_call_id,
    items,
    total_amount,
    status,
    valid_until,
    quotation_number,
    delivery_method,
    buyer_name,
    buyer_phone,
    payment_details,
    workflow_status,
    payment_timeline,
    staff_responses,
    payment_notes,
    next_follow_up,
    payment_reminders,
    staff_follow_ups,
    bill_status,
    bill_generated_at,
    bill_sent_at,
    bill_paid_at,
    created_at,
    updated_at,
    deleted_by,
    customers
  ) VALUES (
    OLD.id,
    OLD.customer_id,
    OLD.video_call_id,
    OLD.items,
    OLD.total_amount,
    OLD.status,
    OLD.valid_until,
    OLD.quotation_number,
    OLD.delivery_method,
    OLD.buyer_name,
    OLD.buyer_phone,
    OLD.payment_details,
    OLD.workflow_status,
    OLD.payment_timeline,
    OLD.staff_responses,
    OLD.payment_notes,
    OLD.next_follow_up,
    OLD.payment_reminders,
    OLD.staff_follow_ups,
    OLD.bill_status,
    OLD.bill_generated_at,
    OLD.bill_sent_at,
    OLD.bill_paid_at,
    OLD.created_at,
    OLD.updated_at,
    auth.uid(),
    customer_data
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for quotation deletion
DROP TRIGGER IF EXISTS quotation_soft_delete_trigger ON quotations;
CREATE TRIGGER quotation_soft_delete_trigger
  BEFORE DELETE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION handle_quotation_deletion();

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_deleted_quotations_customer_id ON deleted_quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_deleted_quotations_deleted_at ON deleted_quotations(deleted_at);
CREATE INDEX IF NOT EXISTS idx_deleted_quotations_quotation_number ON deleted_quotations(quotation_number);