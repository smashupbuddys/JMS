Creating fresh SQL user creation script

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- First clean up any existing user with the same email
DO $$
DECLARE
    v_user_id uuid;
    v_email text := 'smash@gmail.com';
    v_password text := '@pplepie9229S';
BEGIN
    -- Check if the user already exists
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
    
    -- If user exists, first delete related records
    IF v_user_id IS NOT NULL THEN
        RAISE NOTICE 'Cleaning up existing user with ID %', v_user_id;
        
        -- Delete from staff first (respects foreign key constraints)
        DELETE FROM public.staff WHERE id = v_user_id;
        
        -- Delete from users next
        DELETE FROM public.users WHERE id = v_user_id;
        
        -- Finally delete from auth.users
        DELETE FROM auth.users WHERE id = v_user_id;
    END IF;
    
    -- Create new user with proper fields
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        aud,
        role,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        is_sso_user
    )
    VALUES (
        gen_random_uuid(),  -- Generate a new UUID
        v_email,
        crypt(v_password, gen_salt('bf')),
        now(),  -- Email confirmed
        'authenticated',  -- Required for Supabase auth
        'authenticated',  -- Required for Supabase auth
        now(),
        now(),
        '{"provider":"email","providers":["email"]}',  -- Required app metadata
        '{"full_name":"Admin User"}',  -- User metadata
        true,  -- Super admin
        false  -- Not SSO
    )
    RETURNING id INTO v_user_id;
    
    RAISE NOTICE 'Created new auth user with ID %', v_user_id;
    
    -- Create entry in public.users
    INSERT INTO public.users (
        id,
        email,
        role,
        full_name,
        is_active,
        created_at,
        updated_at
    )
    VALUES (
        v_user_id,
        v_email,
        'admin',
        'Admin User',
        true,
        now(),
        now()
    );
    
    RAISE NOTICE 'Created user record in public.users';
    
    -- Create entry in public.staff
    INSERT INTO public.staff (
        id,
        employee_id,
        department,
        position,
        permissions,
        created_at,
        updated_at
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
        ),
        now(),
        now()
    );
    
    RAISE NOTICE 'Created staff record in public.staff';
    
    -- Final verification
    RAISE NOTICE E'\n--- Final Verification ---';
    RAISE NOTICE 'User exists in auth.users: %', (SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email));
    RAISE NOTICE 'User exists in public.users: %', (SELECT EXISTS (SELECT 1 FROM public.users WHERE email = v_email));
    RAISE NOTICE 'Staff record exists: %', (SELECT EXISTS (SELECT 1 FROM public.staff WHERE id = v_user_id));
    
    -- Print login instructions
    RAISE NOTICE E'\n--- Login Instructions ---';
    RAISE NOTICE 'You can now log in with:';
    RAISE NOTICE 'Email: %', v_email;
    RAISE NOTICE 'Password: %', v_password;
END $$;
