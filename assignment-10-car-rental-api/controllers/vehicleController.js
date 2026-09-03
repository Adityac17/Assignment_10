'use strict';

/**
 * Vehicle fleet controller.
 */

const supabase = require('../config/supabase');
const { sendSuccess, sendError } = require('../middleware/errorHandler');

const VALID_CATEGORIES = ['Sedan', 'SUV', 'Luxury', 'Hatchback', 'Electric'];
const VALID_STATUSES = ['available', 'rented', 'maintenance'];

/**
 * GET /api/vehicles  (public)
 * Optional filters: ?category=&status= (combinable)
 */
async function listVehicles(req, res, next) {
  try {
    const { category, status } = req.query;

    let query = supabase.from('vehicles').select('*').order('id', { ascending: true });

    if (category) query = query.eq('category', category);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return sendError(res, 400, error.message);

    return sendSuccess(res, 200, 'Vehicles fetched.', data);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/vehicles/:id  (public)
 * Includes the vehicle's past rental records.
 */
async function getVehicle(req, res, next) {
  try {
    const { id } = req.params;

    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !vehicle) {
      return sendError(res, 404, 'Vehicle not found.');
    }

    const { data: rentals, error: rentalError } = await supabase
      .from('rentals')
      .select('*')
      .eq('vehicle_id', id)
      .order('start_date', { ascending: false });

    if (rentalError) return sendError(res, 400, rentalError.message);

    return sendSuccess(res, 200, 'Vehicle fetched.', {
      ...vehicle,
      rentals: rentals || [],
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/vehicles  (auth required)
 */
async function createVehicle(req, res, next) {
  try {
    const { brand, model, year, category, daily_rate, fuel_type, seating_capacity, status } =
      req.body || {};

    // Required-field validation.
    const missing = [];
    if (!brand) missing.push('brand');
    if (!model) missing.push('model');
    if (year === undefined || year === null) missing.push('year');
    if (!category) missing.push('category');
    if (daily_rate === undefined || daily_rate === null) missing.push('daily_rate');
    if (!fuel_type) missing.push('fuel_type');
    if (missing.length) {
      return sendError(res, 400, `Missing required field(s): ${missing.join(', ')}.`);
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return sendError(res, 400, `category must be one of: ${VALID_CATEGORIES.join(', ')}.`);
    }

    if (Number(daily_rate) <= 0 || !Number.isFinite(Number(daily_rate))) {
      return sendError(res, 400, 'daily_rate must be a positive number.');
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return sendError(res, 400, `status must be one of: ${VALID_STATUSES.join(', ')}.`);
    }

    const insertPayload = {
      brand,
      model,
      year: Number(year),
      category,
      daily_rate: Number(daily_rate),
      fuel_type,
    };
    if (seating_capacity !== undefined && seating_capacity !== null) {
      insertPayload.seating_capacity = Number(seating_capacity);
    }
    if (status) insertPayload.status = status;

    const { data, error } = await supabase
      .from('vehicles')
      .insert(insertPayload)
      .select()
      .single();

    if (error) return sendError(res, 400, error.message);

    return sendSuccess(res, 201, 'Vehicle created.', data);
  } catch (err) {
    return next(err);
  }
}

/**
 * PUT /api/vehicles/:id  (auth required)
 * Partial update — only provided fields are changed.
 */
async function updateVehicle(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const allowed = [
      'brand',
      'model',
      'year',
      'category',
      'daily_rate',
      'fuel_type',
      'seating_capacity',
      'status',
    ];

    const updates = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return sendError(res, 400, 'No updatable fields provided.');
    }

    if (updates.category && !VALID_CATEGORIES.includes(updates.category)) {
      return sendError(res, 400, `category must be one of: ${VALID_CATEGORIES.join(', ')}.`);
    }
    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
      return sendError(res, 400, `status must be one of: ${VALID_STATUSES.join(', ')}.`);
    }
    if (updates.daily_rate !== undefined && Number(updates.daily_rate) <= 0) {
      return sendError(res, 400, 'daily_rate must be a positive number.');
    }

    // Ensure the vehicle exists first, so we can return a proper 404.
    const { data: existing, error: findError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return sendError(res, 404, 'Vehicle not found.');
    }

    const { data, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return sendError(res, 400, error.message);

    return sendSuccess(res, 200, 'Vehicle updated.', data);
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/vehicles/:id  (auth required)
 * Refuses with 400 "Has Active Bookings" if any rental for this vehicle is
 * in status 'booked' or 'active'.
 */
async function deleteVehicle(req, res, next) {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return sendError(res, 404, 'Vehicle not found.');
    }

    const { data: activeRentals, error: rentalError } = await supabase
      .from('rentals')
      .select('id')
      .eq('vehicle_id', id)
      .in('status', ['booked', 'active']);

    if (rentalError) return sendError(res, 400, rentalError.message);

    if (activeRentals && activeRentals.length > 0) {
      return sendError(res, 400, 'Has Active Bookings');
    }

    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) return sendError(res, 400, error.message);

    return sendSuccess(res, 200, 'Vehicle deleted.');
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
};
