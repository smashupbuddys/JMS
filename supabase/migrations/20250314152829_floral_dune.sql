/*
  # Add Product Attributes Column

  1. Changes
    - Add attributes JSONB column to products table
    - Set default empty JSONB object
    - Add index for performance
*/

-- Add attributes column if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'attributes'
  ) THEN
    ALTER TABLE products 
    ADD COLUMN attributes jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create index for JSON attributes querying if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_products_attributes'
  ) THEN
    CREATE INDEX idx_products_attributes ON products USING gin (attributes);
  END IF;
END $$;

-- Add comment explaining the column usage
COMMENT ON COLUMN products.attributes IS 'Product attributes stored as JSONB (e.g., material, size, weight, etc)';