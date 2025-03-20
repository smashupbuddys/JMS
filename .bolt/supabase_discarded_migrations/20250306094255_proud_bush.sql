/*
  # Add stock update function with tracking
  
  1. New Functions
    - `update_product_stock`: Updates product stock level and tracks sales data
      - Parameters:
        - p_product_id: Product ID
        - p_quantity: Quantity to reduce
        - p_manufacturer: Manufacturer name (optional)
        - p_category: Category name (optional) 
        - p_price: Sale price (optional)
      - Updates:
        - Reduces stock level
        - Updates last sold date
        - Updates manufacturer stats
        - Updates category stats
        - Prevents negative stock
      
  2. Security
    - Function accessible to authenticated users only
*/

CREATE OR REPLACE FUNCTION update_product_stock(
  p_product_id uuid,
  p_quantity integer,
  p_manufacturer text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_price numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_stock integer;
  v_manufacturer_id uuid;
BEGIN
  -- Get current stock level
  SELECT stock_level INTO v_current_stock
  FROM products
  WHERE id = p_product_id;

  -- Check if we have enough stock
  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_current_stock, p_quantity;
  END IF;

  -- Update product stock and last sold date
  UPDATE products 
  SET 
    stock_level = stock_level - p_quantity,
    last_sold_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_product_id;

  -- Update manufacturer stats if provided
  IF p_manufacturer IS NOT NULL AND p_category IS NOT NULL AND p_price IS NOT NULL THEN
    -- Get or create manufacturer record
    WITH ins AS (
      INSERT INTO manufacturers (name, created_at)
      VALUES (p_manufacturer, CURRENT_TIMESTAMP)
      ON CONFLICT (name) DO NOTHING
      RETURNING id
    )
    SELECT id INTO v_manufacturer_id
    FROM ins
    UNION ALL
    SELECT id FROM manufacturers WHERE name = p_manufacturer;

    -- Update manufacturer stats
    INSERT INTO manufacturer_stats (
      manufacturer_id,
      category,
      total_sales,
      items_sold,
      last_sale_date
    ) VALUES (
      v_manufacturer_id,
      p_category,
      p_price * p_quantity,
      p_quantity,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (manufacturer_id, category) 
    DO UPDATE SET
      total_sales = manufacturer_stats.total_sales + EXCLUDED.total_sales,
      items_sold = manufacturer_stats.items_sold + EXCLUDED.items_sold,
      last_sale_date = EXCLUDED.last_sale_date;
  END IF;

  -- Create stock movement record
  INSERT INTO stock_movements (
    product_id,
    quantity,
    movement_type,
    reference_type,
    price,
    created_at
  ) VALUES (
    p_product_id,
    p_quantity,
    'sale',
    'pos',
    p_price,
    CURRENT_TIMESTAMP
  );

  -- Check if stock is low after update
  IF (v_current_stock - p_quantity) <= 5 THEN
    INSERT INTO inventory_alerts (
      product_id,
      alert_type,
      current_level,
      threshold_level,
      created_at
    ) VALUES (
      p_product_id,
      'low_stock',
      v_current_stock - p_quantity,
      5,
      CURRENT_TIMESTAMP
    );
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_product_stock TO authenticated;