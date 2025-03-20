#!/bin/bash
# Script to backup and share Supabase table structures and data
# Note: You need to have supabase CLI installed and be logged in

# Set your database URL (replace with your actual URL)
# Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres
# DATABASE_URL="postgresql://postgres:password@db.projectid.supabase.co:5432/postgres"

# Create a backup folder
mkdir -p supabase_backup

# Export table schemas
echo "Exporting table schemas..."

# Auth users table schema (no data)
pg_dump --dbname="$DATABASE_URL" --schema-only --table=auth.users \
  > supabase_backup/auth_users_schema.sql

# Public users table schema (no data)
pg_dump --dbname="$DATABASE_URL" --schema-only --table=public.users \
  > supabase_backup/public_users_schema.sql

# Public staff table schema (no data)
pg_dump --dbname="$DATABASE_URL" --schema-only --table=public.staff \
  > supabase_backup/public_staff_schema.sql

# Export minimal data (only for troubleshooting, exclude sensitive info)
echo "Exporting minimal data for troubleshooting..."

# Using psql to extract limited data safely
psql "$DATABASE_URL" -c "
COPY (
  SELECT 
    id, 
    email, 
    role,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    email_confirmed_at IS NOT NULL as is_confirmed,
    encrypted_password IS NOT NULL as has_password,
    aud
  FROM auth.users
) TO STDOUT WITH CSV HEADER
" > supabase_backup/auth_users_safe.csv

# Public users data
psql "$DATABASE_URL" -c "
COPY (SELECT id, email, role, full_name, is_active, created_at, updated_at FROM public.users) 
TO STDOUT WITH CSV HEADER
" > supabase_backup/public_users.csv

# Public staff data
psql "$DATABASE_URL" -c "
COPY (SELECT id, employee_id, department, position, permissions, created_at, updated_at FROM public.staff) 
TO STDOUT WITH CSV HEADER
" > supabase_backup/public_staff.csv

# Compress the backup
tar -czf supabase_backup.tar.gz supabase_backup

echo "Backup completed: supabase_backup.tar.gz"
echo "You can share this file for troubleshooting."
echo "NOTE: This backup contains database structure and minimal data for troubleshooting."
echo "No sensitive information like passwords are included." 