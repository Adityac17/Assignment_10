-- ============================================================================
-- Car Rental & Fleet Booking System — Database Schema
-- Paste this whole file into the Supabase SQL editor and run it.
--
-- Note: auth.users is created and managed automatically by Supabase Auth.
--       You do NOT create it here. rentals.user_id references it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- vehicles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicles (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  brand            text NOT NULL,
  model            text NOT NULL,
  year             int NOT NULL,
  category         text NOT NULL CHECK (category IN ('Sedan', 'SUV', 'Luxury', 'Hatchback', 'Electric')),
  daily_rate       numeric(10, 2) NOT NULL CHECK (daily_rate > 0),
  fuel_type        text NOT NULL,
  seating_capacity int NOT NULL DEFAULT 5,
  status           text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'rented', 'maintenance')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- rentals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rentals (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        uuid REFERENCES auth.users (id),
  vehicle_id     bigint NOT NULL REFERENCES vehicles (id) ON DELETE RESTRICT,
  customer_name  text NOT NULL,
  customer_email text NOT NULL,
  start_date     date NOT NULL,
  end_date       date NOT NULL,
  total_cost     numeric(10, 2) NOT NULL,
  status         text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'active', 'completed', 'cancelled')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

-- ---------------------------------------------------------------------------
-- Helpful indexes for the collision check and ownership queries.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rentals_vehicle_id ON rentals (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_rentals_user_id ON rentals (user_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status ON rentals (status);
CREATE INDEX IF NOT EXISTS idx_vehicles_category ON vehicles (category);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles (status);
