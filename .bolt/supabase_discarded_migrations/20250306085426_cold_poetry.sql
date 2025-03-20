/*
  # Create manufacturer analytics table

  1. New Tables
    - `manufacturer_analytics`
      - `manufacturer` (text, primary key)
      - `total_sales` (numeric)
      - `total_items` (integer)
      - `total_revenue` (numeric)
      - `average_price` (numeric)
      - `top_categories` (jsonb)
      - `monthly_trend` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create manufacturer analytics table
CREATE TABLE IF NOT EXISTS manufacturer_analytics (
  manufacturer text PRIMARY KEY,
  total_sales numeric DEFAULT 0,
  total_items integer DEFAULT 0,
  total_revenue numeric DEFAULT 0,
  average_price numeric DEFAULT 0,
  top_categories jsonb DEFAULT '{}',
  monthly_trend jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE manufacturer_analytics ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to view manufacturer analytics"
  ON manufacturer_analytics
  FOR SELECT
  TO authenticated
  USING (true);

-- Create update trigger to maintain updated_at
CREATE OR REPLACE FUNCTION update_manufacturer_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_manufacturer_analytics_timestamp
  BEFORE UPDATE ON manufacturer_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_manufacturer_analytics_updated_at();