-- Create admin user in auth.users first
INSERT INTO auth.users (
    email,
    raw_user_meta_data,
    email_confirmed_at,
    created_at,
    updated_at,
    role,
    is_super_admin
)
VALUES (
    'smash@gmail.com',
    jsonb_build_object('full_name', 'Admin User'),
    now(),
    now(),
    now(),
    'authenticated',
    true
)
ON CONFLICT (email) DO NOTHING;

-- Get the user's UUID
DO $$ 
DECLARE
    v_user_id uuid;
BEGIN
    -- Get the user's UUID from auth.users
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = 'smash@gmail.com';

    -- Insert into users table with admin role
    INSERT INTO public.users (
        id,
        email,
        role,
        full_name,
        is_active
    )
    VALUES (
        v_user_id,
        'smash@gmail.com',
        'admin',
        'Admin User',
        true
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin',
        is_active = true;

    -- Insert into staff table
    INSERT INTO public.staff (
        id,
        employee_id,
        department,
        position,
        permissions
    )
    VALUES (
        v_user_id,
        'ADMIN001',
        'Administration',
        'System Administrator',
        jsonb_build_object(
            'dashboard', true,
            'inventory', true,
            'customers', true,
            'sales', true,
            'reports', true,
            'settings', true
        )
    )
    ON CONFLICT (id) DO UPDATE
    SET permissions = EXCLUDED.permissions;
END $$; 