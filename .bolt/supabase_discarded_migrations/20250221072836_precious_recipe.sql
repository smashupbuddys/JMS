-- First drop any existing primary key constraint
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'company_settings' 
    AND constraint_type = 'PRIMARY KEY'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE company_settings DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'company_settings'
      AND constraint_type = 'PRIMARY KEY'
    );
  END IF;
END $$;

-- Create a temporary table to store the latest settings
CREATE TEMP TABLE latest_settings AS
SELECT DISTINCT ON (name) *
FROM company_settings
ORDER BY name, created_at DESC;

-- Delete all rows from company_settings
DELETE FROM company_settings;

-- Insert only the latest settings back
INSERT INTO company_settings (
  name,
  legal_name,
  address,
  city,
  state,
  pincode,
  phone,
  email,
  website,
  gst_number,
  pan_number,
  bank_details,
  video_call_settings
)
SELECT
  'Jewelry Management System',
  'JMS Pvt Ltd',
  '123 Diamond Street',
  'Mumbai',
  'Maharashtra',
  '400001',
  '+91 98765 43210',
  'contact@jms.com',
  'www.jms.com',
  '27AABCU9603R1ZX',
  'AABCU9603R',
  jsonb_build_object(
    'bank_name', 'HDFC Bank',
    'account_name', 'JMS Pvt Ltd',
    'account_number', '50100123456789',
    'ifsc_code', 'HDFC0001234',
    'branch', 'Diamond District'
  ),
  jsonb_build_object(
    'allow_retail', true,
    'allow_wholesale', true,
    'retail_notice_hours', 24,
    'wholesale_notice_hours', 48
  )
WHERE NOT EXISTS (SELECT 1 FROM company_settings);

-- Create a function to enforce single row
CREATE OR REPLACE FUNCTION enforce_single_row()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM company_settings) > 0 THEN
    RAISE EXCEPTION 'Only one company settings row is allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce single row
DROP TRIGGER IF EXISTS enforce_single_row_trigger ON company_settings;
CREATE TRIGGER enforce_single_row_trigger
  BEFORE INSERT ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_single_row();

-- Add helpful comment
COMMENT ON TABLE company_settings IS 'Stores company-wide settings. Only one row is allowed via trigger constraint.';
