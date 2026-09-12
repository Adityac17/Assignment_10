# Car Rental & Fleet Booking System API

> A RESTful API for managing a vehicle fleet and its rentals — with authentication, date-overlap collision detection, and server-authoritative cost calculation. Built with Node.js, Express, and Supabase (PostgreSQL + Auth).

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.19-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20DB-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Managed-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)

---

## Overview

This API powers a small car-rental business. Vehicles can be browsed publicly and managed by authenticated staff, while customers' rentals are booked, cancelled, and completed through protected, ownership-scoped endpoints. The interesting parts of the domain are handled on the server so they cannot be tampered with by the client:

- **Booking collision detection** — a new rental is rejected if its date range overlaps any existing `booked`/`active` rental for the same vehicle, including partial overlaps.
- **Server-authoritative pricing** — the total cost is always computed from the rental span and the vehicle's `daily_rate`; the client never sets the price.
- **Consistent responses** — every endpoint returns the same `{ success, message, data? }` envelope, and all errors flow through a single centralized handler.

### Features

- JWT-based authentication backed by **Supabase Auth** (register / login).
- Public, filterable vehicle catalogue with per-vehicle rental history.
- Protected vehicle CRUD with validation and a delete guard for vehicles that still have active bookings.
- Rentals with **date-overlap collision detection** and **server-side cost calculation**.
- Cancel and complete flows with ownership checks and state rules.
- Pure, unit-tested booking utilities (overlap + cost) with **no** database or HTTP coupling.
- A ready-to-run **Postman collection** covering the full happy path plus the collision case.
- Boots even without credentials (logs a clear warning) so the project can be inspected offline.

---

## Tech Stack

| Layer            | Technology                                  |
| ---------------- | ------------------------------------------- |
| Runtime          | Node.js (CommonJS)                          |
| Web framework    | Express 4                                   |
| Database         | PostgreSQL (managed by Supabase)            |
| Authentication   | Supabase Auth (`@supabase/supabase-js`)     |
| Config           | dotenv                                      |
| CORS             | cors                                        |
| Dev tooling      | nodemon                                     |
| Testing          | Node's built-in `assert` (zero-dependency)  |

---

## Project Structure

```
assignment-10-car-rental-api/
├── config/
│   └── supabase.js              # Supabase client factory (boots with a warning if env is missing)
├── controllers/
│   ├── authController.js        # register / login via Supabase Auth
│   ├── vehicleController.js     # fleet CRUD + filters + delete guard
│   └── rentalController.js      # booking, collision check, cost calc, cancel, complete
├── middleware/
│   ├── auth.js                  # requireAuth — verifies Bearer token, attaches req.user
│   └── errorHandler.js          # sendSuccess/sendError helpers + 404 + centralized error handler
├── routes/
│   ├── authRoutes.js
│   ├── vehicleRoutes.js
│   └── rentalRoutes.js
├── utils/
│   ├── rentalUtils.js           # pure helpers: daysBetween, calculateTotalCost, datesOverlap, ...
│   └── rentalUtils.test.js      # zero-dependency unit tests for the above
├── migrations/
│   └── schema.sql               # vehicles + rentals tables, checks, constraints, indexes
├── postman/
│   └── car-rental-api.postman_collection.json
├── .env.example
├── package.json
└── server.js                    # Express app: middleware, routes, health check, error handler
```

---

## Prerequisites

- **Node.js 18+** and npm
- A free **[Supabase](https://supabase.com/)** project (for PostgreSQL + Auth)

---

## Installation & Setup

```bash
# 1. Clone the repository
git clone https://github.com/Adityac17/Assignment_10.git
cd Assignment_10/assignment-10-car-rental-api

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env
# then fill in the values (see below)
```

### Environment Variables

Create a `.env` file in `assignment-10-car-rental-api/` with the following:

| Variable            | Required | Default | Description                                                             |
| ------------------- | -------- | ------- | ----------------------------------------------------------------------- |
| `SUPABASE_URL`      | Yes      | —       | Supabase project URL (Project Settings → API → Project URL).            |
| `SUPABASE_ANON_KEY` | Yes      | —       | Supabase anon/public API key (Project Settings → API → anon public).    |
| `PORT`              | No       | `3000`  | Port the Express server listens on.                                     |

> If `SUPABASE_URL` or `SUPABASE_ANON_KEY` is missing, the server still boots and prints a clear `[WARNING]`; any request that touches the database or auth will then fail gracefully with a clean JSON error until real credentials are provided.

---

## Supabase Setup

1. **Create a project** at [supabase.com](https://supabase.com/) and wait for it to provision.
2. **Run the schema** — open the **SQL Editor**, paste the entire contents of [`migrations/schema.sql`](migrations/schema.sql), and run it. This creates the `vehicles` and `rentals` tables along with their check constraints and indexes.
3. **Copy your credentials** — go to **Project Settings → API**, then copy the **Project URL** into `SUPABASE_URL` and the **anon public** key into `SUPABASE_ANON_KEY` in your `.env`.
4. **Auth is managed for you** — the `auth.users` table is created and managed automatically by **Supabase Auth**; you never create or write to it directly. The `rentals.user_id` column references `auth.users(id)`, and user display names are stored in Supabase Auth `user_metadata.name` at sign-up.

---

## Database Schema Overview

### `vehicles`

| Column             | Type            | Notes                                                                     |
| ------------------ | --------------- | ------------------------------------------------------------------------- |
| `id`               | `bigint`        | Primary key, generated always as identity.                                |
| `brand`            | `text`          | Required.                                                                 |
| `model`            | `text`          | Required.                                                                 |
| `year`             | `int`           | Required.                                                                 |
| `category`         | `text`          | Required. `CHECK IN ('Sedan', 'SUV', 'Luxury', 'Hatchback', 'Electric')`. |
| `daily_rate`       | `numeric(10,2)` | Required. `CHECK (daily_rate > 0)`.                                        |
| `fuel_type`        | `text`          | Required.                                                                 |
| `seating_capacity` | `int`           | Defaults to `5`.                                                          |
| `status`           | `text`          | Defaults to `available`. `CHECK IN ('available', 'rented', 'maintenance')`.|
| `created_at`       | `timestamptz`   | Defaults to `now()`.                                                      |

### `rentals`

| Column           | Type            | Notes                                                                          |
| ---------------- | --------------- | ------------------------------------------------------------------------------ |
| `id`             | `bigint`        | Primary key, generated always as identity.                                     |
| `user_id`        | `uuid`          | References `auth.users(id)` — the authenticated owner of the booking.          |
| `vehicle_id`     | `bigint`        | Required. References `vehicles(id)` `ON DELETE RESTRICT`.                       |
| `customer_name`  | `text`          | Required.                                                                      |
| `customer_email` | `text`          | Required.                                                                      |
| `start_date`     | `date`          | Required.                                                                      |
| `end_date`       | `date`          | Required.                                                                      |
| `total_cost`     | `numeric(10,2)` | Required. Computed server-side.                                                |
| `status`         | `text`          | Defaults to `booked`. `CHECK IN ('booked', 'active', 'completed', 'cancelled')`.|
| `created_at`     | `timestamptz`   | Defaults to `now()`.                                                           |

Additional constraints and indexes: a table-level `CHECK (end_date >= start_date)`, the `ON DELETE RESTRICT` foreign key from `rentals.vehicle_id`, and indexes on `rentals(vehicle_id)`, `rentals(user_id)`, `rentals(status)`, `vehicles(category)`, and `vehicles(status)` to keep collision checks and ownership queries fast.

---

## Running the Server

```bash
# Development (auto-reload via nodemon)
npm run dev

# Production
npm start
```

The API will be available at `http://localhost:3000` (or your configured `PORT`).

- `GET /` — root health/info payload listing the mounted endpoint groups.
- `GET /health` — simple liveness check.

---

## API Reference

All responses use the envelope `{ success, message, data? }`. Protected endpoints require an `Authorization: Bearer <access_token>` header, where the token is the Supabase `access_token` returned by login.

### Auth — `/api/auth`

| Method | Endpoint             | Auth | Description                                                                   |
| ------ | -------------------- | ---- | ---------------------------------------------------------------------------- |
| POST   | `/api/auth/register` | No   | Register a user via Supabase Auth. Body: `{ name, email, password }`.        |
| POST   | `/api/auth/login`    | No   | Log in; returns the Supabase `access_token`. Body: `{ email, password }`.    |

### Vehicles — `/api/vehicles`

| Method | Endpoint             | Auth | Description                                                                                             |
| ------ | -------------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| GET    | `/api/vehicles`      | No   | List vehicles. Optional, combinable filters: `?category=` and `?status=`.                              |
| GET    | `/api/vehicles/:id`  | No   | Get a single vehicle, including its past rental records (`rentals`, newest first).                     |
| POST   | `/api/vehicles`      | Yes  | Create a vehicle. Validates required fields, `category`, `status`, and positive `daily_rate`.          |
| PUT    | `/api/vehicles/:id`  | Yes  | Partial update — only provided fields change; returns `404` if the vehicle does not exist.             |
| DELETE | `/api/vehicles/:id`  | Yes  | Delete a vehicle. **Guarded:** returns `400 "Has Active Bookings"` if any rental is `booked`/`active`. |

### Rentals — `/api/rentals`

| Method | Endpoint                     | Auth | Description                                                                                                       |
| ------ | ---------------------------- | ---- | --------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/rentals`               | Yes  | Book a vehicle. Runs the collision check and computes `total_cost` server-side. Body includes dates + customer.  |
| GET    | `/api/rentals/my-bookings`   | Yes  | List rentals owned by the authenticated user, newest first.                                                      |
| PATCH  | `/api/rentals/:id/cancel`    | Yes  | Cancel a booking (owner only). Allowed only when status is `booked` **and** `start_date` is in the future.       |
| PATCH  | `/api/rentals/:id/complete`  | Yes  | Complete a booking (owner only); marks it `completed` and returns the vehicle to `available`.                    |

---

## Core Logic Notes

### Date-overlap collision detection

Before a booking is written, the API fetches all `booked`/`active` rentals for that vehicle and checks the requested range against each. Two inclusive ranges `[aStart, aEnd]` and `[bStart, bEnd]` **do not** overlap only when one ends strictly before the other begins:

```
noOverlap = (aEnd < bStart) OR (aStart > bEnd)
overlap   = NOT noOverlap
```

Ranges are treated as inclusive on both ends, so a booking ending on the same day another begins is a conflict (the vehicle isn't returned and re-prepared instantaneously). Partial overlaps are caught — for example:

```
existing:  2026-05-01  →  2026-05-05
new:       2026-05-03  →  2026-05-07     ❌ collides (400)
```

A collision returns `400 "Vehicle already reserved during this timeframe"`.

### Server-authoritative cost

The client never sets the price. Cost is always computed on the server from the calendar span and the vehicle's `daily_rate`:

```
total_cost = daysBetween(start_date, end_date) * vehicle.daily_rate
```

Dates are normalized to UTC midnight to avoid timezone drift, `daily_rate` must be positive, and a same-day booking (`start_date === end_date`) is billed a **minimum of one day** so the customer is never charged `0`.

---

## Postman Collection

A complete Postman collection lives at [`postman/car-rental-api.postman_collection.json`](postman/car-rental-api.postman_collection.json). Import it into Postman to walk the full flow in order:

1. Register → 2. Login → 3. Create Vehicle → 4. List Vehicles (filterable) → 5. Get Vehicle by id (includes rentals) → 6. Book Vehicle (`2026-05-01` → `2026-05-05`) → 7. Colliding Booking (`2026-05-03` → `2026-05-07`, **expects 400**) → 8. Book Vehicle #2 → 9. Cancel Booking → 10. Complete Booking → 11. My Bookings.

## Unit Tests

The pure booking helpers in `utils/rentalUtils.js` are covered by zero-dependency tests using Node's built-in `assert`. They exercise `daysBetween`, `calculateTotalCost`, `datesOverlap`, `hasBookingCollision`, and `isFutureDate` — including the partial-overlap collision scenario and the cost formula. Run them with:

```bash
npm test
```

The process exits with a non-zero code if any assertion fails, so it is CI-friendly.

---

## Example Walkthrough

All requests/responses use the `{ success, message, data? }` envelope.

**1. Register**

```http
POST /api/auth/register
Content-Type: application/json

{ "name": "Aditya", "email": "aditya@example.com", "password": "Str0ngPass!" }
```

```json
{
  "success": true,
  "message": "Registration successful. Please verify your email if confirmation is enabled.",
  "data": { "id": "uuid", "email": "aditya@example.com", "name": "Aditya", "session": null }
}
```

**2. Login** (returns the token used for protected calls)

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "aditya@example.com", "password": "Str0ngPass!" }
```

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "expires_in": 3600,
    "user": { "id": "uuid", "email": "aditya@example.com", "name": "Aditya" }
  }
}
```

**3. Create a vehicle** (protected)

```http
POST /api/vehicles
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "brand": "Tesla", "model": "Model 3", "year": 2024, "category": "Electric",
  "daily_rate": 50, "fuel_type": "Electric", "seating_capacity": 5 }
```

```json
{
  "success": true,
  "message": "Vehicle created.",
  "data": { "id": 1, "brand": "Tesla", "model": "Model 3", "category": "Electric",
            "daily_rate": 50, "status": "available" }
}
```

**4. Book the vehicle** (protected — cost computed server-side)

```http
POST /api/rentals
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "vehicle_id": 1, "start_date": "2026-05-01", "end_date": "2026-05-05",
  "customer_name": "Aditya", "customer_email": "aditya@example.com" }
```

```json
{
  "success": true,
  "message": "Booking created.",
  "data": { "id": 1, "vehicle_id": 1, "start_date": "2026-05-01", "end_date": "2026-05-05",
            "total_cost": 200, "status": "booked" }
}
```

**5. Attempt a colliding booking** (partial overlap → rejected)

```http
POST /api/rentals
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "vehicle_id": 1, "start_date": "2026-05-03", "end_date": "2026-05-07",
  "customer_name": "Aditya", "customer_email": "aditya@example.com" }
```

```json
{
  "success": false,
  "message": "Vehicle already reserved during this timeframe"
}
```

---

## Design Choices & Notes

- **Consistent response envelope.** Every route uses `{ success, message, data? }` via shared `sendSuccess`/`sendError` helpers, and all thrown errors funnel through one centralized Express error handler. Server-side faults (`>= 500`) are logged without leaking stack traces to clients.
- **Server-authoritative pricing & collision checks.** Cost and availability are never trusted from the client; both are derived on the server from the database state and the pure utils.
- **Pure, testable domain logic.** The booking math lives in `utils/rentalUtils.js` with no database or HTTP dependencies, making it trivial to unit-test in isolation.
- **Inclusive date ranges.** Same-day handoffs count as conflicts, and same-day rentals bill a minimum of one day — both are deliberate, documented business rules.
- **Ownership enforcement.** Cancel/complete verify `rental.user_id === req.user.id` (`403` otherwise), and `my-bookings` is scoped to the authenticated user.
- **Delete guard & referential integrity.** Vehicles with active bookings cannot be deleted (`400 "Has Active Bookings"`), reinforced at the database level by `ON DELETE RESTRICT`.
- **Graceful boot without credentials.** Missing Supabase env vars produce a warning rather than a crash, so the app can be started and inspected without a live project.
- **Auth delegated to Supabase.** User accounts, password hashing, and tokens are handled by Supabase Auth; the app only verifies Bearer tokens and reads `req.user`.

---

## License

MIT

## Author

**Aditya S Chouksey**
