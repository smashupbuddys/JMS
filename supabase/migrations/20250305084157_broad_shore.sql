/*
  # Initial Database Schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `created_at` (timestamp)
    - `staff`
      - `id` (uuid, primary key) 
      - `name` (text)
      - `email` (text, unique)
      - `role` (text)
      - `active` (boolean)
      - `notification_preferences` (jsonb)
      - `created_at` (timestamp)
    - `customers`
      - `id` (uuid, primary key)
      - `name` (text)
      - `email` (text)
      - `phone` (text, unique)
      - `type` (text)
      - `preferences` (jsonb)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create staff table
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL,
  active boolean DEFAULT true,
  notification_preferences jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text UNIQUE NOT NULL,
  type text NOT NULL DEFAULT 'retailer',
  preferences jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Staff can read own data"
  ON staff
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Staff can read customer data"
  ON customers
  FOR SELECT
  TO authenticated
  USING (true);