/*
  # Add Deleted Quotations Table

  1. New Tables
    - `deleted_quotations`
      - Stores soft-deleted quotations with full history
      - Includes all original quotation fields plus deletion metadata
      - Maintains referential integrity with customers

  2. Changes
    - Add trigger for moving deleted quotations
    - Add cleanup function for old deleted quotations

  3. Security
    - Enable RLS
    - Add policies for staff access
*/

-- Create deleted_quotations table
CREATE TABLE IF NOT EXISTS deleted_quotations (
  id uuid PRIMARY KEY,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  video_call_id uuid,
  items jsonb NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  status text NOT NULL,
  payment_details jsonb,
  workflow_status jsonb,
  quotation_number text,
  valid_until timestamptz,
  bill_status text,
  bill_generated_at timestamptz,
  bill_sent_at timestamptz,
  bill_paid_at timestamptz,
  payment_timeline jsonb[] DEFAULT '{}',
  staff_reminders jsonb[] DEFAULT '{}',
  staff_follow_ups jsonb[] DEFAULT '{}',
  deleted_at timestamptz DEFAULT now(),
  deleted_by uuid,
  deletion_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE deleted_quotations ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Staff can view deleted quotations"
  ON deleted_quotations
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (
    SELECT id FROM staff WHERE active = true
  ));

-- Function to automatically clean up old deleted quotations
CREATE OR REPLACE FUNCTION cleanup_old_deleted_quotations()
RETURNS void AS $$
BEGIN
  -- Delete quotations older than 30 days
  DELETE FROM deleted_quotations
  WHERE deleted_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup to run daily
SELECT cron.schedule(
  'cleanup-deleted-quotations',
  '0 0 * * *', -- Run at midnight every day
  'SELECT cleanup_old_deleted_quotations()'
);

-- Add index for faster queries
CREATE INDEX idx_deleted_quotations_deleted_at ON deleted_quotations(deleted_at);
CREATE INDEX idx_deleted_quotations_customer_id ON deleted_quotations(customer_id);

-- Add function to move quotation to deleted_quotations
CREATE OR REPLACE FUNCTION move_to_deleted_quotations()
RETURNS trigger AS $$
BEGIN
  -- Insert the deleted quotation into deleted_quotations
  INSERT INTO deleted_quotations (
    id,
    customer_id,
    video_call_id,
    items,
    total_amount,
    status,
    payment_details,
    workflow_status,
    quotation_number,
    valid_until,
    bill_status,
    bill_generated_at,
    bill_sent_at,
    bill_paid_at,
    payment_timeline,
    staff_reminders,
    staff_follow_ups,
    deleted_by,
    created_at,
    updated_at
  )
  VALUES (
    OLD.id,
    OLD.customer_id,
    OLD.video_call_id,
    OLD.items,
    OLD.total_amount,
    OLD.status,
    OLD.payment_details,
    OLD.workflow_status,
    OLD.quotation_number,
    OLD.valid_until,
    OLD.bill_status,
    OLD.bill_generated_at,
    OLD.bill_sent_at,
    OLD.bill_paid_at,
    OLD.payment_timeline,
    OLD.staff_reminders,
    OLD.staff_follow_ups,
    auth.uid(),
    OLD.created_at,
    OLD.updated_at
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to quotations table
CREATE TRIGGER quotation_deleted
  BEFORE DELETE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION move_to_deleted_quotations();

-- Add comment
COMMENT ON TABLE deleted_quotations IS 'Stores deleted quotations for audit and recovery purposes';