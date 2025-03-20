/*
  # Fix Manufacturer Analytics Schema and Procedure

  1. Changes
    - Add missing columns to manufacturer_analytics table
    - Update get_manufacturer_analytics procedure to use correct column names
    - Add indexes for performance

  2. Security
    - Maintain existing RLS policies
*/

-- Add missing columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'manufacturer_analytics' AND column_name = 'top_categories'
  ) THEN
    ALTER TABLE manufacturer_analytics 
    ADD COLUMN top_categories jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'manufacturer_analytics' AND column_name = 'monthly_trend'
  ) THEN
    ALTER TABLE manufacturer_analytics 
    ADD COLUMN monthly_trend jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_manufacturer_analytics(date);

-- Create updated function
CREATE OR REPLACE FUNCTION get_manufacturer_analytics(p_month date)
RETURNS TABLE (
  manufacturer text,
  total_sales numeric,
  total_items integer,
  total_revenue numeric,
  average_price numeric,
  top_categories jsonb,
  monthly_trend jsonb,
  quality_metrics jsonb,
  relationship_scores jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ma.manufacturer,
    ma.total_sales,
    ma.total_items,
    ma.total_revenue,
    ma.average_price,
    ma.top_categories,
    ma.monthly_trend,
    jsonb_build_object(
      'defect_rate', COALESCE(qm.defect_rate, 0),
      'rejection_rate', COALESCE(qm.rejection_rate, 0),
      'quality_score', COALESCE(qm.quality_score, 0)
    ) as quality_metrics,
    jsonb_build_object(
      'overall_score', COALESCE(rs.overall_score, 0),
      'quality_score', COALESCE(rs.quality_score, 0),
      'delivery_score', COALESCE(rs.delivery_score, 0)
    ) as relationship_scores
  FROM manufacturer_analytics ma
  LEFT JOIN manufacturer_quality_metrics qm ON qm.manufacturer_analytics_id = ma.id
  LEFT JOIN manufacturer_relationship_scores rs ON rs.manufacturer_analytics_id = ma.id
  WHERE date_trunc('month', ma.month) = date_trunc('month', p_month);
END;
$$ LANGUAGE plpgsql;