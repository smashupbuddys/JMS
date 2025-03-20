/*
  # Manufacturer Analytics Schema and Procedures
  
  1. New Tables
    - manufacturer_analytics
    - manufacturer_quality_metrics
    - manufacturer_relationship_scores
  
  2. Functions
    - get_manufacturer_analytics
    
  3. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create manufacturer analytics table if not exists
CREATE TABLE IF NOT EXISTS manufacturer_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer text NOT NULL,
  month date NOT NULL,
  total_sales numeric DEFAULT 0,
  total_items integer DEFAULT 0,
  total_revenue numeric DEFAULT 0,
  average_price numeric DEFAULT 0,
  top_categories jsonb DEFAULT '{}'::jsonb,
  monthly_trend jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(manufacturer, month)
);

-- Create quality metrics table
CREATE TABLE IF NOT EXISTS manufacturer_quality_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_analytics_id uuid REFERENCES manufacturer_analytics(id),
  defect_rate numeric DEFAULT 0,
  rejection_rate numeric DEFAULT 0,
  quality_score numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create relationship scores table
CREATE TABLE IF NOT EXISTS manufacturer_relationship_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_analytics_id uuid REFERENCES manufacturer_analytics(id),
  overall_score numeric DEFAULT 0,
  quality_score numeric DEFAULT 0,
  delivery_score numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE manufacturer_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE manufacturer_quality_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE manufacturer_relationship_scores ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Allow read access to authenticated users" ON manufacturer_analytics
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access to authenticated users" ON manufacturer_quality_metrics
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access to authenticated users" ON manufacturer_relationship_scores
  FOR SELECT TO authenticated USING (true);

-- Create function to get manufacturer analytics
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