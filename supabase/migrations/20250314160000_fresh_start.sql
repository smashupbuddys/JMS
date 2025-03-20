/*
  # Complete Fresh Database Setup

  1. Core Tables:
    - users
    - staff
    - customers
  
  2. Product Management:
    - products
    - markup_settings
  
  3. Analytics:
    - daily_analytics
    - sales_metrics
    - manufacturer_analytics
    - category_analytics
  
  4. Sales System:
    - sales_transactions
    - sale_items
    - sale_payments
    - quotations
  
  5. Stock Management:
    - stock_update_errors
    - stock_update_history
  
  Features:
    - Complete foreign key relationships
    - Row Level Security (RLS)
    - Proper indexes
    - Audit timestamps
    - Error handling
    - Analytics tracking
*/

-- Drop all existing tables (in correct order to handle dependencies)
DROP TABLE IF EXISTS sale_payments CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales_transactions CASCADE;
DROP TABLE IF EXISTS stock_update_history CASCADE;
DROP TABLE IF EXISTS stock_update_errors CASCADE;
DROP TABLE IF EXISTS quotations CASCADE;
DROP TABLE IF EXISTS daily_analytics CASCADE;
DROP TABLE IF EXISTS sales_metrics CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS manufacturer_analytics CASCADE;
DROP TABLE IF EXISTS category_analytics CASCADE;
DROP TABLE IF EXISTS markup_settings CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop existing functions first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS update_product_stock(uuid,integer,text,text,numeric);
DROP FUNCTION IF EXISTS update_daily_analytics();
DROP FUNCTION IF EXISTS update_sales_metrics();
DROP FUNCTION IF EXISTS ensure_manufacturer_exists(text);
DROP FUNCTION IF EXISTS ensure_category_exists(text);
DROP FUNCTION IF EXISTS calculate_product_prices(text,text,numeric);
DROP FUNCTION IF EXISTS handle_product_changes();
DROP FUNCTION IF EXISTS handle_markup_setting_changes();
DROP FUNCTION IF EXISTS get_markup_settings(text);
DROP FUNCTION IF EXISTS update_markup_setting(text,text,numeric);
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS check_user_permission(text);

-- Drop existing type
DROP TYPE IF EXISTS user_role CASCADE;

-- Create roles enum
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff', 'viewer');

-- Create users table with auth integration
CREATE TABLE users (
    id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    email text UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'staff',
    full_name text,
    avatar_url text,
    is_active boolean DEFAULT true,
    last_sign_in_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create staff table linked to users
CREATE TABLE staff (
    id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    employee_id text UNIQUE,
    department text,
    position text,
    permissions jsonb DEFAULT '{
        "dashboard": true,
        "inventory": true,
        "customers": true,
        "sales": true,
        "reports": false,
        "settings": false
    }',
    notification_preferences jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create customers table
CREATE TABLE customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    email text,
    phone text UNIQUE NOT NULL,
    type text NOT NULL DEFAULT 'retailer',
    preferences jsonb DEFAULT '{}',
    purchase_history jsonb DEFAULT '[]',
    category_preferences jsonb DEFAULT '{}',
    manufacturer_preferences jsonb DEFAULT '{}',
    total_purchases numeric DEFAULT 0,
    last_purchase_date timestamptz,
    registration_date timestamptz DEFAULT now(),
    country text,
    source text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create markup_settings table
CREATE TABLE markup_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL CHECK (type IN ('manufacturer', 'category')),
    name text NOT NULL,
    code text,
    markup numeric NOT NULL CHECK (markup > 0),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(type, name)
);

-- Create manufacturer_analytics table
CREATE TABLE manufacturer_analytics (
    manufacturer text PRIMARY KEY,
    total_sales numeric DEFAULT 0,
    total_items integer DEFAULT 0,
    month date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE),
    sales_stats jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create category_analytics table
CREATE TABLE category_analytics (
    category text PRIMARY KEY,
    total_sales numeric DEFAULT 0,
    total_items integer DEFAULT 0,
    month date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create products table
CREATE TABLE products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    manufacturer text REFERENCES manufacturer_analytics(manufacturer) ON UPDATE CASCADE ON DELETE SET NULL,
    category text REFERENCES category_analytics(category) ON UPDATE CASCADE ON DELETE SET NULL,
    sku text UNIQUE,
    buy_price numeric NOT NULL CHECK (buy_price > 0),
    wholesale_price numeric NOT NULL CHECK (wholesale_price > buy_price),
    retail_price numeric NOT NULL CHECK (retail_price > wholesale_price),
    stock_level integer DEFAULT 0,
    image_url text,
    qr_code text,
    code128 text,
    cipher text,
    additional_info text,
    attributes jsonb DEFAULT '{}',
    last_sold_at timestamptz,
    dead_stock_status text CHECK (dead_stock_status IN ('normal', 'warning', 'critical')),
    dead_stock_days integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create stock_update_errors table
CREATE TABLE stock_update_errors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid REFERENCES products(id),
    attempted_quantity integer NOT NULL,
    current_stock integer NOT NULL,
    error_message text NOT NULL,
    error_code text,
    error_context jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Create stock_update_history table
CREATE TABLE stock_update_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid REFERENCES products(id),
    previous_stock integer NOT NULL,
    new_stock integer NOT NULL,
    change_amount integer NOT NULL,
    change_type text NOT NULL CHECK (change_type IN ('sale', 'purchase', 'adjustment', 'return')),
    reference_id uuid,
    reference_type text,
    staff_id uuid REFERENCES staff(id),
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Create daily_analytics table
CREATE TABLE daily_analytics (
    date date PRIMARY KEY DEFAULT CURRENT_DATE,
    total_sales numeric DEFAULT 0,
    items_sold integer DEFAULT 0,
    hourly_sales jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create sales_metrics table
CREATE TABLE sales_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_sales numeric DEFAULT 0,
    weekly_sales numeric DEFAULT 0,
    monthly_sales numeric DEFAULT 0,
    total_sales numeric DEFAULT 0,
    last_updated timestamptz DEFAULT now()
);

-- Create quotations table
CREATE TABLE quotations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_number text NOT NULL UNIQUE,
    customer_id uuid REFERENCES customers(id),
    video_call_id uuid,
    items jsonb NOT NULL DEFAULT '[]',
    total_amount numeric NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    payment_details jsonb,
    workflow_status jsonb DEFAULT '{"qc": "pending", "packaging": "pending", "dispatch": "pending"}',
    valid_until timestamptz,
    bill_status text DEFAULT 'pending',
    bill_generated_at timestamptz,
    bill_paid_at timestamptz,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create sales_transactions table
CREATE TABLE sales_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_number text UNIQUE NOT NULL,
    sale_type text NOT NULL CHECK (sale_type IN ('counter', 'video_call')),
    customer_id uuid REFERENCES customers(id),
    video_call_id uuid,
    quotation_id uuid REFERENCES quotations(id),
    total_amount numeric NOT NULL CHECK (total_amount >= 0),
    payment_status text NOT NULL CHECK (payment_status IN ('completed', 'partial', 'pending')),
    payment_details jsonb NOT NULL,
    analytics jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    created_by uuid REFERENCES staff(id),
    notes text
);

-- Create sale_items table
CREATE TABLE sale_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id uuid NOT NULL REFERENCES sales_transactions(id),
    product_id uuid NOT NULL REFERENCES products(id),
    quantity integer NOT NULL CHECK (quantity > 0),
    unit_price numeric NOT NULL CHECK (unit_price >= 0),
    total_price numeric NOT NULL CHECK (total_price >= 0),
    manufacturer text NOT NULL,
    category text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Create sale_payments table
CREATE TABLE sale_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id uuid NOT NULL REFERENCES sales_transactions(id),
    amount numeric NOT NULL CHECK (amount > 0),
    payment_method text NOT NULL CHECK (payment_method IN ('cash', 'card', 'upi', 'bank_transfer')),
    payment_status text NOT NULL CHECK (payment_status IN ('completed', 'pending', 'failed')),
    payment_date timestamptz DEFAULT now(),
    reference_number text,
    metadata jsonb DEFAULT '{}'
);

-- Drop existing indexes first
DROP INDEX IF EXISTS idx_products_manufacturer CASCADE;
DROP INDEX IF EXISTS idx_products_category CASCADE;
DROP INDEX IF EXISTS idx_products_sku CASCADE;
DROP INDEX IF EXISTS idx_products_stock_level CASCADE;
DROP INDEX IF EXISTS idx_products_last_sold CASCADE;
DROP INDEX IF EXISTS idx_products_attributes CASCADE;

DROP INDEX IF EXISTS idx_customers_phone CASCADE;
DROP INDEX IF EXISTS idx_customers_type CASCADE;
DROP INDEX IF EXISTS idx_customers_total_purchases CASCADE;

DROP INDEX IF EXISTS idx_manufacturer_analytics_month CASCADE;
DROP INDEX IF EXISTS idx_category_analytics_month CASCADE;

DROP INDEX IF EXISTS idx_stock_errors_product CASCADE;
DROP INDEX IF EXISTS idx_stock_errors_created_at CASCADE;

DROP INDEX IF EXISTS idx_stock_history_product CASCADE;
DROP INDEX IF EXISTS idx_stock_history_created_at CASCADE;

DROP INDEX IF EXISTS idx_daily_analytics_date CASCADE;
DROP INDEX IF EXISTS idx_quotations_status CASCADE;
DROP INDEX IF EXISTS idx_quotations_customer CASCADE;

DROP INDEX IF EXISTS idx_sales_customer CASCADE;
DROP INDEX IF EXISTS idx_sales_created_at CASCADE;
DROP INDEX IF EXISTS idx_sales_payment_status CASCADE;

DROP INDEX IF EXISTS idx_sale_items_product CASCADE;
DROP INDEX IF EXISTS idx_sale_items_sale CASCADE;

DROP INDEX IF EXISTS idx_sale_payments_sale CASCADE;
DROP INDEX IF EXISTS idx_sale_payments_status CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_manufacturer ON products(manufacturer);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_stock_level ON products(stock_level);
CREATE INDEX IF NOT EXISTS idx_products_last_sold ON products(last_sold_at);
CREATE INDEX IF NOT EXISTS idx_products_attributes ON products USING gin (attributes);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(type);
CREATE INDEX IF NOT EXISTS idx_customers_total_purchases ON customers(total_purchases);

CREATE INDEX IF NOT EXISTS idx_manufacturer_analytics_month ON manufacturer_analytics(month);
CREATE INDEX IF NOT EXISTS idx_category_analytics_month ON category_analytics(month);

CREATE INDEX IF NOT EXISTS idx_stock_errors_product ON stock_update_errors(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_errors_created_at ON stock_update_errors(created_at);

CREATE INDEX IF NOT EXISTS idx_stock_history_product ON stock_update_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_created_at ON stock_update_history(created_at);

CREATE INDEX IF NOT EXISTS idx_daily_analytics_date ON daily_analytics(date);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);

CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales_transactions(payment_status);

CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_status ON sale_payments(payment_status);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE markup_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE manufacturer_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_update_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_update_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;

-- Modify RLS policies for better role-based access

-- Users table policies
CREATE POLICY "Users can read own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can manage all users" ON users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

CREATE POLICY "Managers can view all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('admin', 'manager')
        )
    );

-- Staff table policies
CREATE POLICY "Staff can read own data" ON staff
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can manage all staff" ON staff
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

CREATE POLICY "Managers can view all staff" ON staff
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('admin', 'manager')
        )
    );

-- Customer policies based on role
CREATE POLICY "Staff can read customers" ON customers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND is_active = true
        )
    );

CREATE POLICY "Staff can modify customers" ON customers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND is_active = true
            AND role IN ('admin', 'manager', 'staff')
        )
    );

CREATE POLICY "Staff can update customers" ON customers
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND is_active = true
            AND role IN ('admin', 'manager', 'staff')
        )
    );

-- Product policies based on role
CREATE POLICY "Staff can read products" ON products
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND is_active = true
        )
    );

CREATE POLICY "Staff can modify products" ON products
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND is_active = true
            AND role IN ('admin', 'manager')
        )
    );

-- Analytics policies based on role
CREATE POLICY "Staff can view analytics" ON daily_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND is_active = true
            AND role IN ('admin', 'manager', 'staff')
        )
    );

CREATE POLICY "Staff can view sales metrics" ON sales_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND is_active = true
            AND role IN ('admin', 'manager', 'staff')
        )
    );

-- Sales and quotation policies based on role
CREATE POLICY "Staff can read sales" ON sales_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND is_active = true
        )
    );

CREATE POLICY "Staff can create sales" ON sales_transactions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND is_active = true
            AND role IN ('admin', 'manager', 'staff')
        )
    );

CREATE POLICY "Staff can update sales" ON sales_transactions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND is_active = true
            AND role IN ('admin', 'manager', 'staff')
        )
    );

-- Create function to handle user registration
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO users (id, email, role, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        'staff',  -- Default role
        NEW.raw_user_meta_data->>'full_name'
    );
    
    INSERT INTO staff (id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create function to check user permissions
CREATE OR REPLACE FUNCTION check_user_permission(permission text)
RETURNS boolean AS $$
DECLARE
    v_role user_role;
    v_permissions jsonb;
BEGIN
    -- Get user's role and permissions
    SELECT role, s.permissions
    INTO v_role, v_permissions
    FROM users u
    LEFT JOIN staff s ON s.id = u.id
    WHERE u.id = auth.uid();

    -- Admin has all permissions
    IF v_role = 'admin' THEN
        RETURN true;
    END IF;

    -- Check specific permission
    RETURN (v_permissions->permission)::boolean;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update product stock
CREATE OR REPLACE FUNCTION update_product_stock(
    p_product_id uuid,
    p_quantity integer,
    p_manufacturer text,
    p_category text,
    p_price numeric
) RETURNS void AS $$
DECLARE
    v_current_stock integer;
    v_new_stock integer;
BEGIN
    -- Get current stock
    SELECT stock_level INTO v_current_stock
    FROM products
    WHERE id = p_product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found';
    END IF;

    -- Calculate new stock
    v_new_stock := v_current_stock - p_quantity;

    IF v_new_stock < 0 THEN
        RAISE EXCEPTION 'Insufficient stock';
    END IF;

    -- Update product stock
    UPDATE products
    SET 
        stock_level = v_new_stock,
        last_sold_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_product_id;

    -- Record stock update
    INSERT INTO stock_update_history (
        product_id,
        previous_stock,
        new_stock,
        change_amount,
        change_type
    ) VALUES (
        p_product_id,
        v_current_stock,
        v_new_stock,
        p_quantity,
        'sale'
    );

    -- Update manufacturer analytics
    UPDATE manufacturer_analytics
    SET 
        total_sales = total_sales + (p_price * p_quantity),
        total_items = total_items + p_quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE manufacturer = p_manufacturer;

    -- Update category analytics
    UPDATE category_analytics
    SET 
        total_sales = total_sales + (p_price * p_quantity),
        total_items = total_items + p_quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE category = p_category;

EXCEPTION WHEN others THEN
    -- Log error
    INSERT INTO stock_update_errors (
        product_id,
        attempted_quantity,
        current_stock,
        error_message,
        error_code,
        error_context
    ) VALUES (
        p_product_id,
        p_quantity,
        v_current_stock,
        SQLERRM,
        SQLSTATE,
        jsonb_build_object(
            'manufacturer', p_manufacturer,
            'category', p_category,
            'price', p_price
        )
    );
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Create function to update daily analytics
CREATE OR REPLACE FUNCTION update_daily_analytics() RETURNS trigger AS $$
DECLARE
    v_total_sales numeric := 0;
    v_items_sold integer := 0;
    v_current_hour text;
    v_hourly_sales jsonb;
BEGIN
    -- Calculate totals using a single SELECT INTO
    WITH sales_totals AS (
        SELECT 
            COALESCE(SUM(total_amount), 0) as total_amount,
            COALESCE(COUNT(*), 0) as items_count
        FROM sales_transactions s
        WHERE DATE(created_at) = CURRENT_DATE
        AND payment_status = 'completed'
    )
    SELECT 
        total_amount,
        items_count
    INTO 
        v_total_sales,
        v_items_sold
    FROM sales_totals;

    -- Get hourly sales in a separate query
    SELECT hourly_sales 
    INTO v_hourly_sales
    FROM daily_analytics
    WHERE date = CURRENT_DATE;

    IF v_hourly_sales IS NULL THEN
        v_hourly_sales := '{}'::jsonb;
    END IF;

    -- Update hourly sales
    v_current_hour := to_char(CURRENT_TIMESTAMP, 'HH24');
    v_hourly_sales := jsonb_set(
        v_hourly_sales,
        array[v_current_hour],
        to_jsonb(COALESCE((v_hourly_sales->>v_current_hour)::numeric, 0) + NEW.total_amount)
    );

    -- Insert or update daily analytics
    INSERT INTO daily_analytics (
        date,
        total_sales,
        items_sold,
        hourly_sales,
        updated_at
    ) VALUES (
        CURRENT_DATE,
        v_total_sales,
        v_items_sold,
        v_hourly_sales,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (date) DO UPDATE
    SET
        total_sales = EXCLUDED.total_sales,
        items_sold = EXCLUDED.items_sold,
        hourly_sales = EXCLUDED.hourly_sales,
        updated_at = CURRENT_TIMESTAMP;

    RETURN NEW;
EXCEPTION WHEN others THEN
    -- Log error but don't prevent sale completion
    RAISE WARNING 'Error updating daily analytics: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for daily analytics
CREATE TRIGGER update_daily_analytics_trigger
    AFTER INSERT OR UPDATE ON sales_transactions
    FOR EACH ROW
    WHEN (NEW.payment_status = 'completed')
    EXECUTE FUNCTION update_daily_analytics();

-- Create function to update sales metrics
CREATE OR REPLACE FUNCTION update_sales_metrics() RETURNS void AS $$
DECLARE
    v_daily_sales numeric;
    v_weekly_sales numeric;
    v_monthly_sales numeric;
    v_total_sales numeric;
BEGIN
    -- Calculate daily sales
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_daily_sales
    FROM sales_transactions
    WHERE DATE(created_at) = CURRENT_DATE
    AND payment_status = 'completed';

    -- Calculate weekly sales
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_weekly_sales
    FROM sales_transactions
    WHERE created_at >= date_trunc('week', CURRENT_DATE)
    AND payment_status = 'completed';

    -- Calculate monthly sales
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_monthly_sales
    FROM sales_transactions
    WHERE created_at >= date_trunc('month', CURRENT_DATE)
    AND payment_status = 'completed';

    -- Calculate total sales
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_total_sales
    FROM sales_transactions
    WHERE payment_status = 'completed';

    -- Update sales metrics
    INSERT INTO sales_metrics (
        daily_sales,
        weekly_sales,
        monthly_sales,
        total_sales,
        last_updated
    ) VALUES (
        v_daily_sales,
        v_weekly_sales,
        v_monthly_sales,
        v_total_sales,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) DO UPDATE
    SET
        daily_sales = EXCLUDED.daily_sales,
        weekly_sales = EXCLUDED.weekly_sales,
        monthly_sales = EXCLUDED.monthly_sales,
        total_sales = EXCLUDED.total_sales,
        last_updated = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create function to ensure manufacturer exists
CREATE OR REPLACE FUNCTION ensure_manufacturer_exists(p_manufacturer text) 
RETURNS void AS $$
BEGIN
    INSERT INTO manufacturer_analytics (manufacturer)
    VALUES (p_manufacturer)
    ON CONFLICT (manufacturer) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Create function to ensure category exists
CREATE OR REPLACE FUNCTION ensure_category_exists(p_category text) 
RETURNS void AS $$
BEGIN
    INSERT INTO category_analytics (category)
    VALUES (p_category)
    ON CONFLICT (category) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate prices based on markup settings
CREATE OR REPLACE FUNCTION calculate_product_prices(
    p_manufacturer text,
    p_category text,
    p_buy_price numeric
) RETURNS jsonb AS $$
DECLARE
    v_manufacturer_markup numeric;
    v_category_markup numeric;
    v_wholesale_markup numeric;
    v_retail_markup numeric;
BEGIN
    -- Get manufacturer markup
    SELECT markup INTO v_manufacturer_markup
    FROM markup_settings
    WHERE type = 'manufacturer' AND name = p_manufacturer;

    -- Get category markup
    SELECT markup INTO v_category_markup
    FROM markup_settings
    WHERE type = 'category' AND name = p_category;

    -- Use default markups if not found
    v_manufacturer_markup := COALESCE(v_manufacturer_markup, 1.3);
    v_category_markup := COALESCE(v_category_markup, 1.4);

    -- Calculate wholesale and retail markups
    v_wholesale_markup := v_manufacturer_markup;
    v_retail_markup := v_manufacturer_markup * v_category_markup;

    -- Return calculated prices
    RETURN jsonb_build_object(
        'wholesale_price', ROUND((p_buy_price * v_wholesale_markup)::numeric, 2),
        'retail_price', ROUND((p_buy_price * v_retail_markup)::numeric, 2)
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to handle product creation/update
CREATE OR REPLACE FUNCTION handle_product_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_prices jsonb;
BEGIN
    -- Ensure manufacturer exists
    PERFORM ensure_manufacturer_exists(NEW.manufacturer);
    
    -- Ensure category exists
    PERFORM ensure_category_exists(NEW.category);
    
    -- Calculate prices based on markup settings
    v_prices := calculate_product_prices(
        NEW.manufacturer,
        NEW.category,
        NEW.buy_price
    );
    
    -- Set the calculated prices if not explicitly provided
    IF TG_OP = 'INSERT' OR NEW.wholesale_price IS NULL THEN
        NEW.wholesale_price := (v_prices->>'wholesale_price')::numeric;
    END IF;
    
    IF TG_OP = 'INSERT' OR NEW.retail_price IS NULL THEN
        NEW.retail_price := (v_prices->>'retail_price')::numeric;
    END IF;
    
    -- Update timestamps
    NEW.updated_at := CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for product changes
CREATE TRIGGER handle_product_changes_trigger
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION handle_product_changes();

-- Create function to handle markup setting changes
CREATE OR REPLACE FUNCTION handle_markup_setting_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate markup value
    IF NEW.markup <= 0 THEN
        RAISE EXCEPTION 'Markup must be greater than 0';
    END IF;
    
    -- Update timestamps
    NEW.updated_at := CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for markup setting changes
CREATE TRIGGER handle_markup_setting_changes_trigger
    BEFORE INSERT OR UPDATE ON markup_settings
    FOR EACH ROW
    EXECUTE FUNCTION handle_markup_setting_changes();

-- Add function to get markup settings
CREATE OR REPLACE FUNCTION get_markup_settings(p_type text)
RETURNS TABLE (
    name text,
    code text,
    markup numeric,
    created_at timestamptz,
    updated_at timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ms.name,
        ms.code,
        ms.markup,
        ms.created_at,
        ms.updated_at
    FROM markup_settings ms
    WHERE ms.type = p_type
    ORDER BY ms.name;
END;
$$ LANGUAGE plpgsql;

-- Add function to update markup setting
CREATE OR REPLACE FUNCTION update_markup_setting(
    p_type text,
    p_name text,
    p_code text,
    p_markup numeric
) RETURNS void AS $$
BEGIN
    INSERT INTO markup_settings (type, name, code, markup)
    VALUES (p_type, p_name, p_code, p_markup)
    ON CONFLICT (type, name) 
    DO UPDATE SET
        code = EXCLUDED.code,
        markup = EXCLUDED.markup,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies for markup_settings table
CREATE POLICY "Staff can view markup settings" ON markup_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND is_active = true
        )
    );

CREATE POLICY "Admins and managers can modify markup settings" ON markup_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND is_active = true
            AND role IN ('admin', 'manager')
        )
    ); 