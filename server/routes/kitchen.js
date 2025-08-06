const express = require('express');
const { 
  getKitchenUnits,
  updateKitchenUnitStatus,
  getKitchenDashboard
} = require('../controllers/kitchenController');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(verifyToken);

// Solo personal de cocina puede acceder
router.use(requireRole(['admin', 'kitchen']));

// GET /kitchen/units?status=pending - Listar unidades pendientes
router.get('/units', getKitchenUnits);

// PATCH /kitchen/units/:unitId/status - Cambiar estado de unidad
router.patch('/units/:unitId/status', updateKitchenUnitStatus);

// GET /kitchen/dashboard - Dashboard de cocina
router.get('/dashboard', getKitchenDashboard);

module.exports = router; 