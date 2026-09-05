'use strict';

/**
 * Rentals & booking controller — the core business logic of the API.
 */

const supabase = require('../config/supabase');
const { sendSuccess, sendError } = require('../middleware/errorHandler');
const {
  calculateTotalCost,
  hasBookingCollision,
  isFutureDate,
  daysBetween,
} = require('../utils/rentalUtils');

/**
 * POST /api/rentals  (auth required)
 * Body: { vehicle_id, start_date, end_date, customer_name, customer_email }
 */
async function createRental(req, res, next) {
  try {
    const { vehicle_id, start_date, end_date, customer_name, customer_email } = req.body || {};

    const missing = [];
    if (vehicle_id === undefined || vehicle_id === null) missing.push('vehicle_id');
    if (!start_date) missing.push('start_date');
    if (!end_date) missing.push('end_date');
    if (!customer_name) missing.push('customer_name');
    if (!customer_email) missing.push('customer_email');
    if (missing.length) {
      return sendError(res, 400, `Missing required field(s): ${missing.join(', ')}.`);
    }

    // 1. Validate date order.
    if (daysBetween(start_date, end_date) < 0) {
      return sendError(res, 400, 'end_date must be on or after start_date.');
    }

    // Fetch the vehicle to (a) confirm it exists and (b) get daily_rate for cost.
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', vehicle_id)
      .single();

    if (vehicleError || !vehicle) {
      return sendError(res, 404, 'Vehicle not found.');
    }

    // 2. Collision check against existing booked/active rentals for this vehicle.
    const { data: existingRentals, error: existingError } = await supabase
      .from('rentals')
      .select('start_date, end_date, status')
      .eq('vehicle_id', vehicle_id)
      .in('status', ['booked', 'active']);

    if (existingError) return sendError(res, 400, existingError.message);

    if (hasBookingCollision({ start_date, end_date }, existingRentals || [])) {
      return sendError(res, 400, 'Vehicle already reserved during this timeframe');
    }

    // 3. Compute total cost server-side (never trust the client).
    const total_cost = calculateTotalCost(start_date, end_date, vehicle.daily_rate);

    // 4. Insert the rental owned by the authenticated user.
    const insertPayload = {
      user_id: req.user.id,
      vehicle_id: Number(vehicle_id),
      customer_name,
      customer_email,
      start_date,
      end_date,
      total_cost,
      status: 'booked',
    };

    const { data, error } = await supabase
      .from('rentals')
      .insert(insertPayload)
      .select()
      .single();

    if (error) return sendError(res, 400, error.message);

    // 5. Return the created rental including the computed cost.
    return sendSuccess(res, 201, 'Booking created.', data);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/rentals/my-bookings  (auth required)
 * Only rentals owned by the authenticated user.
 */
async function myBookings(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('rentals')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return sendError(res, 400, error.message);

    return sendSuccess(res, 200, 'Your bookings fetched.', data);
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/rentals/:id/cancel  (auth required, owner only)
 * Allowed only when status is 'booked' AND start_date is in the future.
 */
async function cancelRental(req, res, next) {
  try {
    const { id } = req.params;

    const { data: rental, error: findError } = await supabase
      .from('rentals')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !rental) {
      return sendError(res, 404, 'Rental not found.');
    }

    // Ownership check.
    if (rental.user_id !== req.user.id) {
      return sendError(res, 403, 'You do not own this booking.');
    }

    if (rental.status !== 'booked' || !isFutureDate(rental.start_date)) {
      return sendError(res, 400, 'Cannot Cancel');
    }

    const { data, error } = await supabase
      .from('rentals')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (error) return sendError(res, 400, error.message);

    return sendSuccess(res, 200, 'Booking cancelled.', data);
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/rentals/:id/complete  (auth required, owner only)
 * Sets rental status 'completed' and returns the vehicle to 'available'.
 */
async function completeRental(req, res, next) {
  try {
    const { id } = req.params;

    const { data: rental, error: findError } = await supabase
      .from('rentals')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !rental) {
      return sendError(res, 404, 'Rental not found.');
    }

    if (rental.user_id !== req.user.id) {
      return sendError(res, 403, 'You do not own this booking.');
    }

    const { data, error } = await supabase
      .from('rentals')
      .update({ status: 'completed' })
      .eq('id', id)
      .select()
      .single();

    if (error) return sendError(res, 400, error.message);

    // Return the vehicle to available so it can be booked again.
    const { error: vehicleError } = await supabase
      .from('vehicles')
      .update({ status: 'available' })
      .eq('id', rental.vehicle_id);

    if (vehicleError) return sendError(res, 400, vehicleError.message);

    return sendSuccess(res, 200, 'Booking completed and vehicle marked available.', data);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createRental,
  myBookings,
  cancelRental,
  completeRental,
};
