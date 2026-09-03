'use strict';

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const {
  createRental,
  myBookings,
  cancelRental,
  completeRental,
} = require('../controllers/rentalController');

// All rental routes require authentication.
router.post('/', requireAuth, createRental);
router.get('/my-bookings', requireAuth, myBookings);
router.patch('/:id/cancel', requireAuth, cancelRental);
router.patch('/:id/complete', requireAuth, completeRental);

module.exports = router;
