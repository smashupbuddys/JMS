/*
  # Add Category Analytics Table

  1. New Tables
    - `category_analytics` - Tracks category-level analytics and metrics
      - `category` (text, primary key) - Category name/code
      - `total_sales` (numeric) - Total sales amount for category
      - `total_items` (integer) - Total items sold in category
      - `month` (date) - Month of analytics
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create category_analytics table
CREATE TABLE IF NOT EXISTS category_analytics (
  category text NOT NULL,
  total_sales numeric DEFAULT 0,
  total_items integer DEFAULT 0,
  month date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (category)
);

-- Add composite unique constraint
ALTER TABLE category_analytics
ADD CONSTRAINT category_analytics_category_month_key 
UNIQUE (category, month);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_category_analytics_category_month 
ON category_analytics(category, month);

-- Enable RLS
ALTER TABLE category_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "category_analytics_read_policy" 
ON category_analytics FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "category_analytics_write_policy" 
ON category_analytics FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_category_analytics_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for timestamp updates
CREATE TRIGGER update_category_analytics_timestamp
  BEFORE UPDATE ON category_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_category_analytics_timestamp();

-- Create function to update category analytics
CREATE OR REPLACE FUNCTION update_category_analytics()
RETURNS trigger AS $$
DECLARE
  v_category text;
  v_amount numeric;
  v_quantity integer;
  v_month date;
BEGIN
  -- Get the current month
  v_month := date_trunc('month', CURRENT_DATE);
  
  -- For each item in the quotation
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    -- Extract category and calculate amounts
    v_category := item->'product'->>'category';
    v_amount := (item->>'price')::numeric * (item->>'quantity')::integer;
    v_quantity := (item->>'quantity')::integer;
    
    -- Update category analytics
    INSERT INTO category_analytics (
      category,
      total_sales,
      total_items,
      month
    ) VALUES (
      v_category,
      v_amount,
      v_quantity,
      v_month
    )
    ON CONFLICT (category) DO UPDATE SET
      total_sales = category_analytics.total_sales + v_amount,
      total_items = category_analytics.total_items + v_quantity,
      updated_at = now();
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for category analytics updates
CREATE TRIGGER update_category_analytics_trigger
  AFTER INSERT OR UPDATE OF status ON quotations
  FOR EACH ROW
  WHEN (NEW.status = 'accepted')
  EXECUTE FUNCTION update_category_analytics();