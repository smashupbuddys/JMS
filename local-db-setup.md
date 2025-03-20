# Setting Up a Self-Hosted Database for Authentication

This guide will walk you through setting up a local PostgreSQL database that mimics your Supabase setup, allowing you to have full control over user authentication.

## Prerequisites

- PostgreSQL (v12 or later) installed on your local machine or server
- Basic knowledge of SQL and command line
- Administrative access to create databases and users

## Step 1: Install PostgreSQL

### Windows
1. Download the installer from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)
2. Run the installer and follow the prompts
3. Remember the password you set for the postgres user
4. Add PostgreSQL bin directory to your PATH

### macOS
```bash
brew install postgresql
brew services start postgresql
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

## Step 2: Create Database and Users

Connect to PostgreSQL and create the database:

```bash
# Login as postgres user
sudo -u postgres psql

# Create database
CREATE DATABASE wms_db;

# Create a user for the application
CREATE USER wms_user WITH ENCRYPTED PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE wms_db TO wms_user;

# Connect to the new database
\c wms_db
```

## Step 3: Create Schema and Extensions

```sql
-- Create auth schema
CREATE SCHEMA auth;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## Step 4: Create Tables Structure

```sql
-- Create auth.users table
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    encrypted_password TEXT,
    email_confirmed_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    raw_app_meta_data JSONB DEFAULT '{}'::JSONB,
    raw_user_meta_data JSONB DEFAULT '{}'::JSONB,
    aud TEXT DEFAULT 'authenticated',
    role TEXT DEFAULT 'authenticated',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    is_sso_user BOOLEAN DEFAULT false,
    is_super_admin BOOLEAN DEFAULT false,
    instance_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'::UUID
);

-- Create public.users table
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    full_name TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create public.staff table
CREATE TABLE public.staff (
    id UUID PRIMARY KEY REFERENCES public.users(id),
    employee_id TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    position TEXT NOT NULL,
    permissions JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Step 5: Create Admin User

```sql
-- Create an admin user
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Insert into auth.users
    INSERT INTO auth.users (
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        aud,
        role,
        is_super_admin
    ) VALUES (
        'smash@gmail.com',
        crypt('@pplepie9229S', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"full_name":"Admin User"}',
        'authenticated',
        'authenticated',
        true
    ) RETURNING id INTO v_user_id;

    -- Insert into public.users
    INSERT INTO public.users (
        id,
        email,
        role,
        full_name,
        is_active
    ) VALUES (
        v_user_id,
        'smash@gmail.com',
        'admin',
        'Admin User',
        true
    );

    -- Insert into public.staff
    INSERT INTO public.staff (
        id,
        employee_id,
        department,
        position,
        permissions
    ) VALUES (
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
    );

    RAISE NOTICE 'Admin user created with ID: %', v_user_id;
END $$;
```

## Step 6: Configure Environment Variables

Update your application's environment variables to point to your self-hosted database:

```
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=your_local_anon_key

# Add these for direct database connection
DATABASE_URL=postgresql://wms_user:your_secure_password@localhost:5432/wms_db
```

## Step 7: Set Up Connection Pooling (Optional but Recommended)

Install PgBouncer for connection pooling:

### Ubuntu/Debian
```bash
sudo apt install pgbouncer
```

Configure pgbouncer.ini:
```ini
[databases]
wms_db = host=localhost port=5432 dbname=wms_db

[pgbouncer]
listen_addr = *
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 100
default_pool_size = 20
```

## Step 8: Test Connection

Test the connection using psql:

```bash
psql -h localhost -U wms_user -d wms_db -p 5432
```

## Step 9: Update Application to Use Self-Hosted Database

1. If you're using Supabase client libraries, you'll need to run a local Supabase instance or switch to direct database connection using a library like `pg` or `typeorm`.

2. Update your authentication logic to handle password verification directly:

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function verifyPassword(email, password) {
  const result = await pool.query(
    'SELECT id, encrypted_password = crypt($1, encrypted_password) as password_matches FROM auth.users WHERE email = $2',
    [password, email]
  );
  
  if (result.rows.length === 0) {
    return { success: false, message: 'User not found' };
  }
  
  if (!result.rows[0].password_matches) {
    return { success: false, message: 'Invalid password' };
  }
  
  return { success: true, userId: result.rows[0].id };
}
```

3. Create a simple JWT token generation function:

```typescript
import jwt from 'jsonwebtoken';

function generateToken(userId, role) {
  const token = jwt.sign(
    { sub: userId, role: role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  return token;
}
```

## Troubleshooting

### Connection Issues
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify database exists: `sudo -u postgres psql -c '\l'`
- Check user permissions: `sudo -u postgres psql -c '\du'`

### Authentication Issues
- Verify password hashing: `SELECT email, encrypted_password IS NOT NULL FROM auth.users;`
- Check foreign key relationships: `SELECT * FROM public.users WHERE id NOT IN (SELECT id FROM auth.users);`

## Benefits of Self-Hosting

1. Full control over user authentication and database structure
2. No conflicts with managed service constraints
3. Direct access for debugging and fixes
4. No dependency on external services for authentication
5. Ability to customize authentication logic 