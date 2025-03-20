/*
  # Manufacturer Analytics Schema

  1. New Tables
    - `manufacturer_analytics`
      - Stores aggregated sales and performance data for manufacturers
      - Includes monthly trends and category breakdowns
    - `manufacturer_quality_metrics`
      - Tracks quality-related metrics like defect rates
      - Links to manufacturer analytics
    - `manufacturer_relationship_scores`
      - Stores relationship and performance scores
      - Provides overall manufacturer assessment

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users

  3. Changes
    - Add foreign key relationships
    - Add indexes for performance
*/

-- Create manufacturer analytics table
CREATE TABLE IF NOT EXISTS manufacturer_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer text NOT NULL,
  month date NOT NULL,
  total_sales numeric DEFAULT 0,
  total_items integer DEFAULT 0,
  total_revenue numeric DEFAULT 0,
  average_price numeric DEFAULT 0,
  top_categories jsonb DEFAULT '{}',
  monthly_trend jsonb DEFAULT '{}',
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

-- Create policies
CREATE POLICY "Allow authenticated read access" ON manufacturer_analytics
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON manufacturer_quality_metrics
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON manufacturer_relationship_scores
  FOR SELECT TO authenticated USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS manufacturer_analytics_manufacturer_idx ON manufacturer_analytics(manufacturer);
CREATE INDEX IF NOT EXISTS manufacturer_analytics_month_idx ON manufacturer_analytics(month);
CREATE INDEX IF NOT EXISTS manufacturer_quality_metrics_analytics_id_idx ON manufacturer_quality_metrics(manufacturer_analytics_id);
CREATE INDEX IF NOT EXISTS manufacturer_relationship_scores_analytics_id_idx ON manufacturer_relationship_scores(manufacturer_analytics_id);

-- Create function to get manufacturer analytics with related data
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
      'defect_rate', qm.defect_rate,
      'rejection_rate', qm.rejection_rate,
      'quality_score', qm.quality_score
    ) as quality_metrics,
    jsonb_build_object(
      'overall_score', rs.overall_score,
      'quality_score', rs.quality_score,
      'delivery_score', rs.delivery_score
    ) as relationship_scores
  FROM manufacturer_analytics ma
  LEFT JOIN manufacturer_quality_metrics qm ON qm.manufacturer_analytics_id = ma.id
  LEFT JOIN manufacturer_relationship_scores rs ON rs.manufacturer_analytics_id = ma.id
  WHERE ma.month = p_month;
END;
$$ LANGUAGE plpgsql;