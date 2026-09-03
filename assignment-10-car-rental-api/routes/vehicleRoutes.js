'use strict';

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const {
  listVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} = require('../controllers/vehicleController');

// Public reads.
router.get('/', listVehicles);
router.get('/:id', getVehicle);

// Protected writes.
router.post('/', requireAuth, createVehicle);
router.put('/:id', requireAuth, updateVehicle);
router.delete('/:id', requireAuth, deleteVehicle);

module.exports = router;
