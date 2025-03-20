/*
  # Enhanced Manufacturer Analytics

  1. New Tables
    - manufacturer_performance: Detailed sales and purchase metrics
    - manufacturer_quality_metrics: Quality and reliability tracking
    - manufacturer_relationship_scores: Supplier relationship management

  2. Features
    - Comprehensive sales tracking
    - Purchase analytics
    - Quality metrics
    - Supplier relationship scoring
    - Historical trend analysis
*/

-- Create manufacturer performance table
CREATE TABLE IF NOT EXISTS manufacturer_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer text NOT NULL,
  month date NOT NULL,
  -- Sales metrics
  total_revenue numeric DEFAULT 0,
  total_sales_volume integer DEFAULT 0,
  market_share_percentage numeric DEFAULT 0,
  customer_satisfaction_rating numeric DEFAULT 0,
  return_rate numeric DEFAULT 0,
  profit_margin numeric DEFAULT 0,
  -- Purchase metrics
  total_procurement_cost numeric DEFAULT 0,
  order_fulfillment_rate numeric DEFAULT 0,
  average_lead_time interval,
  defect_rate numeric DEFAULT 0,
  rejection_rate numeric DEFAULT 0,
  inventory_turnover numeric DEFAULT 0,
  -- Additional metrics
  product_wise_sales jsonb DEFAULT '{}',
  return_reasons jsonb DEFAULT '[]',
  payment_compliance_rate numeric DEFAULT 0,
  relationship_score numeric DEFAULT 0,
  stats jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(manufacturer, month)
);

-- Create manufacturer quality metrics table
CREATE TABLE IF NOT EXISTS manufacturer_quality_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer text NOT NULL,
  date date NOT NULL,
  defect_count integer DEFAULT 0,
  rejection_count integer DEFAULT 0,
  total_inspected integer DEFAULT 0,
  quality_score numeric DEFAULT 0,
  inspection_notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(manufacturer, date)
);

-- Create manufacturer relationship scores table
CREATE TABLE IF NOT EXISTS manufacturer_relationship_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer text NOT NULL,
  month date NOT NULL,
  communication_score numeric DEFAULT 0,
  reliability_score numeric DEFAULT 0,
  quality_score numeric DEFAULT 0,
  pricing_score numeric DEFAULT 0,
  delivery_score numeric DEFAULT 0,
  overall_score numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(manufacturer, month)
);

-- Function to calculate manufacturer performance metrics
CREATE OR REPLACE FUNCTION calculate_manufacturer_performance(
  p_manufacturer text,
  p_month date
)
RETURNS void AS $$
DECLARE
  v_total_sales numeric;
  v_all_sales numeric;
  v_return_count integer;
  v_total_items integer;
BEGIN
  -- Get total sales for this manufacturer
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_total_sales
  FROM sales_analytics
  WHERE manufacturer = p_manufacturer
  AND date_trunc('month', sale_date) = date_trunc('month', p_month);

  -- Get all sales for market share calculation
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_all_sales
  FROM sales_analytics
  WHERE date_trunc('month', sale_date) = date_trunc('month', p_month);

  -- Get return counts
  SELECT COUNT(*), SUM(items_count)
  INTO v_return_count, v_total_items
  FROM sales_analytics
  WHERE manufacturer = p_manufacturer
  AND date_trunc('month', sale_date) = date_trunc('month', p_month);

  -- Update performance metrics
  INSERT INTO manufacturer_performance (
    manufacturer,
    month,
    total_revenue,
    total_sales_volume,
    market_share_percentage,
    return_rate,
    profit_margin
  ) VALUES (
    p_manufacturer,
    p_month,
    v_total_sales,
    v_total_items,
    CASE WHEN v_all_sales > 0 THEN (v_total_sales / v_all_sales) * 100 ELSE 0 END,
    CASE WHEN v_total_items > 0 THEN (v_return_count::numeric / v_total_items) * 100 ELSE 0 END,
    0 -- Calculate actual profit margin based on your business logic
  )
  ON CONFLICT (manufacturer, month) DO UPDATE SET
    total_revenue = EXCLUDED.total_revenue,
    total_sales_volume = EXCLUDED.total_sales_volume,
    market_share_percentage = EXCLUDED.market_share_percentage,
    return_rate = EXCLUDED.return_rate,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Function to update quality metrics
CREATE OR REPLACE FUNCTION update_quality_metrics()
RETURNS trigger AS $$
BEGIN
  -- Update quality metrics when a product is rejected or returned
  INSERT INTO manufacturer_quality_metrics (
    manufacturer,
    date,
    defect_count,
    rejection_count,
    total_inspected,
    quality_score
  ) VALUES (
    NEW.manufacturer,
    CURRENT_DATE,
    CASE WHEN NEW.alert_type = 'defect' THEN 1 ELSE 0 END,
    CASE WHEN NEW.alert_type = 'rejection' THEN 1 ELSE 0 END,
    1,
    CASE 
      WHEN NEW.alert_type IN ('defect', 'rejection') THEN 0 
      ELSE 100 
    END
  )
  ON CONFLICT (manufacturer, date) DO UPDATE SET
    defect_count = manufacturer_quality_metrics.defect_count + 
      CASE WHEN NEW.alert_type = 'defect' THEN 1 ELSE 0 END,
    rejection_count = manufacturer_quality_metrics.rejection_count + 
      CASE WHEN NEW.alert_type = 'rejection' THEN 1 ELSE 0 END,
    total_inspected = manufacturer_quality_metrics.total_inspected + 1,
    quality_score = CASE 
      WHEN manufacturer_quality_metrics.total_inspected + 1 > 0 THEN
        (1 - ((manufacturer_quality_metrics.defect_count + manufacturer_quality_metrics.rejection_count + 
          CASE WHEN NEW.alert_type IN ('defect', 'rejection') THEN 1 ELSE 0 END)::numeric / 
          (manufacturer_quality_metrics.total_inspected + 1))) * 100
      ELSE 100
    END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for quality metrics
DROP TRIGGER IF EXISTS quality_metrics_trigger ON inventory_alerts;
CREATE TRIGGER quality_metrics_trigger
  AFTER INSERT ON inventory_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_quality_metrics();

-- Function to calculate relationship scores
CREATE OR REPLACE FUNCTION calculate_relationship_scores(
  p_manufacturer text,
  p_month date
)
RETURNS void AS $$
DECLARE
  v_communication_score numeric;
  v_reliability_score numeric;
  v_quality_score numeric;
  v_pricing_score numeric;
  v_delivery_score numeric;
BEGIN
  -- Get quality score from quality metrics
  SELECT AVG(quality_score)
  INTO v_quality_score
  FROM manufacturer_quality_metrics
  WHERE manufacturer = p_manufacturer
  AND date_trunc('month', date) = date_trunc('month', p_month);

  -- Get delivery score based on lead times
  SELECT 
    CASE 
      WHEN AVG(EXTRACT(EPOCH FROM average_lead_time)) <= 172800 THEN 100 -- Within 48 hours
      WHEN AVG(EXTRACT(EPOCH FROM average_lead_time)) <= 259200 THEN 80  -- Within 72 hours
      WHEN AVG(EXTRACT(EPOCH FROM average_lead_time)) <= 345600 THEN 60  -- Within 96 hours
      ELSE 40
    END
  INTO v_delivery_score
  FROM manufacturer_performance
  WHERE manufacturer = p_manufacturer
  AND month = p_month;

  -- Calculate overall score
  INSERT INTO manufacturer_relationship_scores (
    manufacturer,
    month,
    quality_score,
    delivery_score,
    overall_score
  ) VALUES (
    p_manufacturer,
    p_month,
    COALESCE(v_quality_score, 0),
    COALESCE(v_delivery_score, 0),
    (COALESCE(v_quality_score, 0) + COALESCE(v_delivery_score, 0)) / 2
  )
  ON CONFLICT (manufacturer, month) DO UPDATE SET
    quality_score = EXCLUDED.quality_score,
    delivery_score = EXCLUDED.delivery_score,
    overall_score = EXCLUDED.overall_score;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_manufacturer_performance_month ON manufacturer_performance(month);
CREATE INDEX IF NOT EXISTS idx_manufacturer_quality_metrics_date ON manufacturer_quality_metrics(date);
CREATE INDEX IF NOT EXISTS idx_manufacturer_relationship_scores_month ON manufacturer_relationship_scores(month);

-- Create function to get comprehensive manufacturer analytics
CREATE OR REPLACE FUNCTION get_manufacturer_analytics(
  p_manufacturer text,
  p_start_date date,
  p_end_date date
)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'sales_performance', (
      SELECT jsonb_build_object(
        'total_revenue', SUM(total_revenue),
        'total_volume', SUM(total_sales_volume),
        'market_share', AVG(market_share_percentage),
        'customer_satisfaction', AVG(customer_satisfaction_rating),
        'return_rate', AVG(return_rate),
        'profit_margin', AVG(profit_margin)
      )
      FROM manufacturer_performance
      WHERE manufacturer = p_manufacturer
      AND month BETWEEN p_start_date AND p_end_date
    ),
    'purchase_metrics', (
      SELECT jsonb_build_object(
        'total_cost', SUM(total_procurement_cost),
        'fulfillment_rate', AVG(order_fulfillment_rate),
        'lead_time', AVG(EXTRACT(EPOCH FROM average_lead_time)),
        'defect_rate', AVG(defect_rate),
        'rejection_rate', AVG(rejection_rate),
        'inventory_turnover', AVG(inventory_turnover)
      )
      FROM manufacturer_performance
      WHERE manufacturer = p_manufacturer
      AND month BETWEEN p_start_date AND p_end_date
    ),
    'quality_metrics', (
      SELECT jsonb_build_object(
        'average_quality_score', AVG(quality_score),
        'total_defects', SUM(defect_count),
        'total_rejections', SUM(rejection_count),
        'inspection_rate', COUNT(*)
      )
      FROM manufacturer_quality_metrics
      WHERE manufacturer = p_manufacturer
      AND date BETWEEN p_start_date AND p_end_date
    ),
    'relationship_scores', (
      SELECT jsonb_build_object(
        'overall_score', AVG(overall_score),
        'quality_score', AVG(quality_score),
        'delivery_score', AVG(delivery_score)
      )
      FROM manufacturer_relationship_scores
      WHERE manufacturer = p_manufacturer
      AND month BETWEEN p_start_date AND p_end_date
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;