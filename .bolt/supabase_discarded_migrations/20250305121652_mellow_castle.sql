-- Add auto-deletion settings to company_settings
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS bill_retention_days integer DEFAULT 90;

-- Function to auto-delete old bills
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
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run auto-deletion
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'auto-delete-bills',
  '0 0 * * *', -- Run at midnight every day
  $$SELECT auto_delete_old_bills()$$
);