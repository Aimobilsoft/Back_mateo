const express = require('express');
const { 
  createOrder,
  getOrders,
  getOrderById,
  addOrderItem,
  updateOrderItem,
  createOrderItemUnits,
  deleteOrderItemUnit,
  updateOrderItemUnit,
  closeOrder,
  deleteOrder
} = require('../controllers/ordersController');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(verifyToken);

// POST /orders - Crear nueva orden
router.post('/', requireRole(['admin', 'waiter']), createOrder);

// GET /orders - Listar órdenes
router.get('/', getOrders);

// GET /orders/:id - Obtener orden específica
router.get('/:id', getOrderById);

// POST /orders/:id/items - Agregar item a orden
router.post('/:id/items', requireRole(['admin', 'waiter']), addOrderItem);

// PATCH /orders/:id/items/:itemId - Modificar item
router.patch('/:id/items/:itemId', requireRole(['admin', 'waiter']), updateOrderItem);

// POST /orders/:id/items/:itemId/units - Crear unidades
router.post('/:id/items/:itemId/units', requireRole(['admin', 'waiter']), createOrderItemUnits);

// DELETE /orders/items/units/:unitId - Eliminar unidad
router.delete('/items/units/:unitId', requireRole(['admin', 'waiter']), deleteOrderItemUnit);

// PATCH /orders/items/units/:unitId - Cambiar estado de unidad
router.patch('/items/units/:unitId', requireRole(['admin', 'waiter', 'kitchen']), updateOrderItemUnit);

// POST /orders/:id/close - Cerrar orden
router.post('/:id/close', requireRole(['admin', 'waiter', 'cashier']), closeOrder);

// DELETE /orders/:id - Eliminar orden
router.delete('/:id', requireRole(['admin']), deleteOrder);

module.exports = router; 