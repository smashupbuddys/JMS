/*
  # Fix Manufacturer Analytics Constraints

  1. Changes
    - Drop existing foreign key constraints
    - Add unique constraint on manufacturer column
    - Add composite unique constraint on manufacturer + month
    - Recreate foreign key constraints with proper references
    - Add performance index

  2. Security
    - Maintain existing RLS policies
*/

-- First drop the foreign key constraints
ALTER TABLE products 
DROP CONSTRAINT IF EXISTS fk_manufacturer,
DROP CONSTRAINT IF EXISTS products_manufacturer_fkey;

-- Ensure manufacturer column has a unique constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'manufacturer_analytics_manufacturer_key'
  ) THEN
    ALTER TABLE manufacturer_analytics
    ADD CONSTRAINT manufacturer_analytics_manufacturer_key 
    UNIQUE (manufacturer);
  END IF;
END $$;

-- Add the composite unique constraint if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'manufacturer_analytics_manufacturer_month_key'
  ) THEN
    ALTER TABLE manufacturer_analytics
    ADD CONSTRAINT manufacturer_analytics_manufacturer_month_key 
    UNIQUE (manufacturer, month);
  END IF;
END $$;

-- Add index for better query performance if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_manufacturer_analytics_manufacturer_month'
  ) THEN
    CREATE INDEX idx_manufacturer_analytics_manufacturer_month 
    ON manufacturer_analytics(manufacturer, month);
  END IF;
END $$;

-- Recreate the foreign key constraints with ON UPDATE CASCADE
ALTER TABLE products
ADD CONSTRAINT fk_manufacturer 
FOREIGN KEY (manufacturer) 
REFERENCES manufacturer_analytics(manufacturer) 
ON UPDATE CASCADE 
ON DELETE SET NULL;

ALTER TABLE products
ADD CONSTRAINT products_manufacturer_fkey
FOREIGN KEY (manufacturer) 
REFERENCES manufacturer_analytics(manufacturer) 
ON UPDATE CASCADE 
ON DELETE RESTRICT;