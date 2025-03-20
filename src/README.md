# Authentication Fix Instructions

## Overview

This guide provides steps to fix authentication issues in the application by:
1. Setting up the admin user properly in the database
2. Using the updated authentication system

## Step 1: Fix Database User with SQL Script

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Paste the content of `create_admin_user.sql` file from this folder
4. Run the script
5. Verify that the script ran without errors

This script:
- Creates proper admin user records in all required tables
- Clears any existing conflicting records
- Sets up the right fields for Supabase authentication
- Configures user with admin role and full permissions

## Step 2: Using the Application

1. Run the application with `npm run dev`
2. Go to the login page
3. Login with:
   - Email: `smash@gmail.com`
   - Password: `@pplepie9229S`

## Troubleshooting

If you encounter login issues:

1. Check browser console for specific error messages
2. Verify that the SQL script ran without errors
3. Click "Run Diagnostics" on the login page
4. Make sure your Supabase credentials in `.env` are correct

## Technical Details

The authentication implementation now:
- Uses Supabase authentication directly
- Properly handles sessions
- Respects foreign key relationships between tables
- Connects to the Supabase tables correctly
- Handles staff permissions properly

## Need Help?

If you continue to experience issues:
1. Share the diagnostic info from the login page
2. Check Supabase logs for authentication errors 