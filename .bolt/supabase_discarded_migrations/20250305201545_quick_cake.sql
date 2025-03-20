/*
  # Admin-Only Quotation Policies

  1. Changes
    - Restrict deleted quotations access to admin role only
    - Add admin-only policies for viewing and restoring
*/

-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Staff can view deleted quotations" ON deleted_quotations;
  DROP POLICY IF EXISTS "Staff can restore deleted quotations" ON deleted_quotations;
END $$;

-- Create admin-only view policy
CREATE POLICY "Admin can view deleted quotations"
  ON deleted_quotations
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (
    SELECT id FROM staff WHERE active = true AND role = 'admin'
  ));

-- Create admin-only restore policy
CREATE POLICY "Admin can restore deleted quotations"
  ON deleted_quotations
  FOR DELETE
  TO authenticated
  USING (auth.uid() IN (
    SELECT id FROM staff WHERE active = true AND role = 'admin'
  ));

-- Add comment
COMMENT ON TABLE deleted_quotations IS 'Stores deleted quotations with admin-only access control';