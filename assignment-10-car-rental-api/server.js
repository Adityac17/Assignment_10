'use strict';

/**
 * Car Rental & Fleet Booking System API
 * Entry point: configures Express, mounts routes, and starts the server.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const rentalRoutes = require('./routes/rentalRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Global middleware.
app.use(cors());
app.use(express.json());

// Health check / root.
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Car Rental & Fleet Booking System API is running.',
    data: {
      endpoints: ['/api/auth', '/api/vehicles', '/api/rentals'],
    },
  });
});

app.get('/health', (req, res) => {
  res.json({ success: true, message: 'ok' });
});

// Feature routes.
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/rentals', rentalRoutes);

// 404 + centralized error handler (must be last).
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Only start listening when run directly (not when imported by tests).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Car Rental API listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
