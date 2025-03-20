-- Add auto-deletion settings to company_settings
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS bill_retention_days integer DEFAULT 90;

-- Create deleted_quotations table
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
  deleted_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on deleted_quotations
ALTER TABLE deleted_quotations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for deleted_quotations
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

-- Function to auto-delete old bills and deleted bills
CREATE OR REPLACE FUNCTION auto_delete_old_bills()
RETURNS void AS $$
DECLARE
  v_retention_days integer;
BEGIN
  -- Get retention days from settings
  SELECT COALESCE(bill_retention_days, 90)
  INTO v_retention_days
  FROM company_settings
  WHERE settings_key = 1;

  -- Delete old quotations
  DELETE FROM quotations
  WHERE created_at < NOW() - (v_retention_days || ' days')::interval
  AND status = 'completed'
  AND bill_status = 'paid';

  -- Delete old deleted_quotations
  DELETE FROM deleted_quotations
  WHERE deleted_at < NOW() - '30 days'::interval;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run auto-deletion
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'auto-delete-bills',
  '0 0 * * *', -- Run at midnight every day
  $$SELECT auto_delete_old_bills()$$
);