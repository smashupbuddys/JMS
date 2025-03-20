/*
  # Fix Deleted Quotations Policy

  1. Changes
    - Drop existing policy if exists
    - Recreate policy with proper checks
    - Add additional policies for staff management
*/

-- Drop existing policy if it exists
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Staff can view deleted quotations" ON deleted_quotations;
END $$;

-- Recreate the policy
CREATE POLICY "Staff can view deleted quotations"
  ON deleted_quotations
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (
    SELECT id FROM staff WHERE active = true
  ));

-- Add policy for restoring quotations
CREATE POLICY "Staff can restore deleted quotations"
  ON deleted_quotations
  FOR DELETE
  TO authenticated
  USING (auth.uid() IN (
    SELECT id FROM staff WHERE active = true AND role IN ('admin', 'manager')
  ));

-- Add comment
COMMENT ON TABLE deleted_quotations IS 'Stores deleted quotations with proper access control';