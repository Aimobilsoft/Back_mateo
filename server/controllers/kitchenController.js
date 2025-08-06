const pool = require('../config/database');

// GET /kitchen/units?status=pending - Listar unidades pendientes para cocina
const getKitchenUnits = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const { status = 'pending' } = req.query;

    // Validar estado
    const validStatuses = ['pending', 'preparing', 'ready'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Estado inválido',
        message: `Estado debe ser uno de: ${validStatuses.join(', ')}`
      });
    }

    const query = `
      SELECT 
        oiu.id as unit_id,
        oiu.status as unit_status,
        oiu.created_at as unit_created_at,
        oi.id as item_id,
        oi.product_name,
        oi.quantity,
        oi.notes as item_notes,
        o.id as order_id,
        o.customer_name,
        o.type as order_type,
        rt.number as table_number,
        u.first_name as waiter_name,
        o.created_at as order_created_at
      FROM order_item_units oiu
      JOIN order_items oi ON oiu.order_item_id = oi.id
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN restaurant_tables rt ON o.table_id = rt.id
      LEFT JOIN users u ON o.waiter_id = u.id
      WHERE o.tenant_id = $1 
        AND oiu.status = $2
        AND o.status NOT IN ('completed', 'cancelled')
      ORDER BY oiu.created_at ASC
    `;
    
    const result = await pool.query(query, [tenant_id, status]);

    res.json({
      units: result.rows,
      count: result.rows.length,
      status: status
    });

  } catch (error) {
    console.error('Error al obtener unidades de cocina:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener las unidades de cocina'
    });
  }
};

// PATCH /kitchen/units/:unitId/status - Cambiar estado de unidad desde cocina
const updateKitchenUnitStatus = async (req, res) => {
  try {
    const { unitId } = req.params;
    const { status } = req.body;
    const tenant_id = req.user.tenant_id;

    // Validar estado
    const validStatuses = ['pending', 'preparing', 'ready'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Estado inválido',
        message: `Estado debe ser uno de: ${validStatuses.join(', ')}`
      });
    }

    // Verificar que la unidad existe y pertenece al tenant
    const unitQuery = `
      SELECT oiu.*, oi.order_id, o.tenant_id, oi.product_name
      FROM order_item_units oiu
      JOIN order_items oi ON oiu.order_item_id = oi.id
      JOIN orders o ON oi.order_id = o.id
      WHERE oiu.id = $1 AND o.tenant_id = $2
    `;
    const unitResult = await pool.query(unitQuery, [unitId, tenant_id]);
    
    if (unitResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Unidad no encontrada',
        message: 'La unidad especificada no existe'
      });
    }

    // Actualizar estado
    const updateQuery = `
      UPDATE order_item_units 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    
    const updateResult = await pool.query(updateQuery, [status, unitId]);

    // Crear notificación si la unidad está lista
    if (status === 'ready') {
      const unit = unitResult.rows[0];
      const notificationQuery = `
        INSERT INTO notifications (tenant_id, user_id, title, message, type)
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      await pool.query(notificationQuery, [
        tenant_id,
        unit.waiter_id || null,
        'Producto listo',
        `El producto "${unit.product_name}" está listo para servir`,
        'order_ready'
      ]);
    }

    res.json({
      message: 'Estado de unidad actualizado exitosamente',
      unit: updateResult.rows[0]
    });

  } catch (error) {
    console.error('Error al actualizar estado de unidad:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al actualizar el estado de la unidad'
    });
  }
};

// GET /kitchen/dashboard - Dashboard de cocina
const getKitchenDashboard = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;

    // Estadísticas generales
    const statsQuery = `
      SELECT 
        COUNT(CASE WHEN oiu.status = 'pending' THEN 1 END) as pending_units,
        COUNT(CASE WHEN oiu.status = 'preparing' THEN 1 END) as preparing_units,
        COUNT(CASE WHEN oiu.status = 'ready' THEN 1 END) as ready_units,
        COUNT(DISTINCT o.id) as active_orders
      FROM order_item_units oiu
      JOIN order_items oi ON oiu.order_item_id = oi.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.tenant_id = $1 AND o.status NOT IN ('completed', 'cancelled')
    `;
    
    const statsResult = await pool.query(statsQuery, [tenant_id]);

    // Productos más pedidos hoy
    const popularQuery = `
      SELECT 
        oi.product_name,
        COUNT(*) as order_count,
        SUM(oi.quantity) as total_quantity
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.tenant_id = $1 
        AND DATE(o.created_at) = CURRENT_DATE
        AND o.status NOT IN ('cancelled')
      GROUP BY oi.product_name
      ORDER BY total_quantity DESC
      LIMIT 10
    `;
    
    const popularResult = await pool.query(popularQuery, [tenant_id]);

    // Órdenes más antiguas pendientes
    const oldestQuery = `
      SELECT 
        o.id as order_id,
        o.customer_name,
        rt.number as table_number,
        COUNT(oiu.id) as pending_units,
        MIN(oiu.created_at) as oldest_unit_time
      FROM orders o
      LEFT JOIN restaurant_tables rt ON o.table_id = rt.id
      JOIN order_items oi ON o.id = oi.order_id
      JOIN order_item_units oiu ON oi.id = oiu.order_item_id
      WHERE o.tenant_id = $1 
        AND o.status NOT IN ('completed', 'cancelled')
        AND oiu.status = 'pending'
      GROUP BY o.id, o.customer_name, rt.number
      ORDER BY oldest_unit_time ASC
      LIMIT 5
    `;
    
    const oldestResult = await pool.query(oldestQuery, [tenant_id]);

    res.json({
      stats: statsResult.rows[0],
      popular_products: popularResult.rows,
      oldest_pending_orders: oldestResult.rows
    });

  } catch (error) {
    console.error('Error al obtener dashboard de cocina:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener el dashboard de cocina'
    });
  }
};

module.exports = {
  getKitchenUnits,
  updateKitchenUnitStatus,
  getKitchenDashboard
}; 