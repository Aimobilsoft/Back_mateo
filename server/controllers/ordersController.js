const pool = require('../config/database');

// POST /orders - Crear nueva orden
const createOrder = async (req, res) => {
  try {
    const { 
      table_id, 
      customer_name, 
      type = 'dine_in', 
      notes 
    } = req.body;
    
    const tenant_id = req.user.tenant_id;
    const waiter_id = req.user.id;

    // Validar campos requeridos
    if (!table_id) {
      return res.status(400).json({
        error: 'Campo requerido',
        message: 'table_id es obligatorio'
      });
    }

    // Verificar que la mesa existe y pertenece al tenant
    const tableQuery = `
      SELECT id, status FROM restaurant_tables 
      WHERE id = $1 AND tenant_id = $2
    `;
    const tableResult = await pool.query(tableQuery, [table_id, tenant_id]);
    
    if (tableResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Mesa no encontrada',
        message: 'La mesa especificada no existe'
      });
    }

    if (tableResult.rows[0].status !== 'available') {
      return res.status(400).json({
        error: 'Mesa no disponible',
        message: 'La mesa no está disponible en este momento'
      });
    }

    // Crear la orden
    const orderQuery = `
      INSERT INTO orders (tenant_id, table_id, waiter_id, customer_name, type, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const orderResult = await pool.query(orderQuery, [
      tenant_id, table_id, waiter_id, customer_name, type, notes
    ]);

    // Actualizar estado de la mesa
    await pool.query(
      'UPDATE restaurant_tables SET status = $1 WHERE id = $2',
      ['occupied', table_id]
    );

    res.status(201).json({
      message: 'Orden creada exitosamente',
      order: orderResult.rows[0]
    });

  } catch (error) {
    console.error('Error al crear orden:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al crear la orden'
    });
  }
};

// GET /orders - Listar órdenes
const getOrders = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const { status, limit = 50, offset = 0 } = req.query;

    let whereClause = 'WHERE o.tenant_id = $1';
    let params = [tenant_id];
    let paramIndex = 1;

    if (status) {
      paramIndex++;
      whereClause += ` AND o.status = $${paramIndex}`;
      params.push(status);
    }

    const query = `
      SELECT 
        o.*,
        u.first_name as waiter_name,
        rt.number as table_number,
        COUNT(oi.id) as items_count
      FROM orders o
      LEFT JOIN users u ON o.waiter_id = u.id
      LEFT JOIN restaurant_tables rt ON o.table_id = rt.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      ${whereClause}
      GROUP BY o.id, u.first_name, rt.number
      ORDER BY o.created_at DESC
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `;
    
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);

    res.json({
      orders: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: result.rows.length
      }
    });

  } catch (error) {
    console.error('Error al obtener órdenes:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener las órdenes'
    });
  }
};

// GET /orders/:id - Obtener orden específica
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant_id = req.user.tenant_id;

    const orderQuery = `
      SELECT 
        o.*,
        u.first_name as waiter_name,
        rt.number as table_number
      FROM orders o
      LEFT JOIN users u ON o.waiter_id = u.id
      LEFT JOIN restaurant_tables rt ON o.table_id = rt.id
      WHERE o.id = $1 AND o.tenant_id = $2
    `;
    
    const orderResult = await pool.query(orderQuery, [id, tenant_id]);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Orden no encontrada',
        message: 'La orden especificada no existe'
      });
    }

    const order = orderResult.rows[0];

    // Obtener items de la orden
    const itemsQuery = `
      SELECT 
        oi.*,
        p.name as product_name,
        p.description as product_description
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
      ORDER BY oi.created_at ASC
    `;
    
    const itemsResult = await pool.query(itemsQuery, [id]);

    // Obtener unidades de cada item
    const itemsWithUnits = await Promise.all(
      itemsResult.rows.map(async (item) => {
        const unitsQuery = `
          SELECT * FROM order_item_units 
          WHERE order_item_id = $1 
          ORDER BY created_at ASC
        `;
        const unitsResult = await pool.query(unitsQuery, [item.id]);
        return {
          ...item,
          units: unitsResult.rows
        };
      })
    );

    res.json({
      order: {
        ...order,
        items: itemsWithUnits
      }
    });

  } catch (error) {
    console.error('Error al obtener orden:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener la orden'
    });
  }
};

// POST /orders/:id/items - Agregar item a orden
const addOrderItem = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { product_id, quantity, notes } = req.body;
    const tenant_id = req.user.tenant_id;

    // Validar campos requeridos
    if (!product_id || !quantity) {
      return res.status(400).json({
        error: 'Campos requeridos',
        message: 'product_id y quantity son obligatorios'
      });
    }

    // Verificar que la orden existe y pertenece al tenant
    const orderQuery = `
      SELECT id, status FROM orders 
      WHERE id = $1 AND tenant_id = $2
    `;
    const orderResult = await pool.query(orderQuery, [orderId, tenant_id]);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Orden no encontrada',
        message: 'La orden especificada no existe'
      });
    }

    if (orderResult.rows[0].status === 'completed' || orderResult.rows[0].status === 'cancelled') {
      return res.status(400).json({
        error: 'Orden no modificable',
        message: 'No se pueden agregar items a una orden completada o cancelada'
      });
    }

    // Verificar que el producto existe y pertenece al tenant
    const productQuery = `
      SELECT id, name, price, available FROM products 
      WHERE id = $1 AND tenant_id = $2
    `;
    const productResult = await pool.query(productQuery, [product_id, tenant_id]);
    
    if (productResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado',
        message: 'El producto especificado no existe'
      });
    }

    if (!productResult.rows[0].available) {
      return res.status(400).json({
        error: 'Producto no disponible',
        message: 'El producto no está disponible'
      });
    }

    const product = productResult.rows[0];
    const price = product.price;
    const subtotal = price * quantity;

    // Crear el item
    const itemQuery = `
      INSERT INTO order_items (order_id, product_id, product_name, quantity, price, subtotal, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const itemResult = await pool.query(itemQuery, [
      orderId, product_id, product.name, quantity, price, subtotal, notes
    ]);

    // Actualizar totales de la orden
    await updateOrderTotals(orderId);

    res.status(201).json({
      message: 'Item agregado exitosamente',
      item: itemResult.rows[0]
    });

  } catch (error) {
    console.error('Error al agregar item:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al agregar el item'
    });
  }
};

// PATCH /orders/:id/items/:itemId - Modificar item
const updateOrderItem = async (req, res) => {
  try {
    const { id: orderId, itemId } = req.params;
    const { quantity, notes } = req.body;
    const tenant_id = req.user.tenant_id;

    // Verificar que la orden existe y pertenece al tenant
    const orderQuery = `
      SELECT id, status FROM orders 
      WHERE id = $1 AND tenant_id = $2
    `;
    const orderResult = await pool.query(orderQuery, [orderId, tenant_id]);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Orden no encontrada',
        message: 'La orden especificada no existe'
      });
    }

    if (orderResult.rows[0].status === 'completed' || orderResult.rows[0].status === 'cancelled') {
      return res.status(400).json({
        error: 'Orden no modificable',
        message: 'No se pueden modificar items de una orden completada o cancelada'
      });
    }

    // Verificar que el item existe y pertenece a la orden
    const itemQuery = `
      SELECT oi.*, p.price 
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.id = $1 AND oi.order_id = $2
    `;
    const itemResult = await pool.query(itemQuery, [itemId, orderId]);
    
    if (itemResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Item no encontrado',
        message: 'El item especificado no existe'
      });
    }

    const item = itemResult.rows[0];
    const price = item.price;
    const newQuantity = quantity || item.quantity;
    const newSubtotal = price * newQuantity;

    // Actualizar el item
    const updateQuery = `
      UPDATE order_items 
      SET quantity = $1, subtotal = $2, notes = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;
    
    const updateResult = await pool.query(updateQuery, [
      newQuantity, newSubtotal, notes || item.notes, itemId
    ]);

    // Actualizar totales de la orden
    await updateOrderTotals(orderId);

    res.json({
      message: 'Item actualizado exitosamente',
      item: updateResult.rows[0]
    });

  } catch (error) {
    console.error('Error al actualizar item:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al actualizar el item'
    });
  }
};

// POST /orders/:id/items/:itemId/units - Crear unidades
const createOrderItemUnits = async (req, res) => {
  try {
    const { id: orderId, itemId } = req.params;
    const { quantity = 1 } = req.body;
    const tenant_id = req.user.tenant_id;

    // Verificar que la orden existe y pertenece al tenant
    const orderQuery = `
      SELECT id, status FROM orders 
      WHERE id = $1 AND tenant_id = $2
    `;
    const orderResult = await pool.query(orderQuery, [orderId, tenant_id]);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Orden no encontrada',
        message: 'La orden especificada no existe'
      });
    }

    // Verificar que el item existe y pertenece a la orden
    const itemQuery = 'SELECT * FROM order_items WHERE id = $1 AND order_id = $2';
    const itemResult = await pool.query(itemQuery, [itemId, orderId]);
    
    if (itemResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Item no encontrado',
        message: 'El item especificado no existe'
      });
    }

    // Crear las unidades
    const units = [];
    for (let i = 0; i < quantity; i++) {
      const unitQuery = `
        INSERT INTO order_item_units (order_item_id, status)
        VALUES ($1, 'pending')
        RETURNING *
      `;
      const unitResult = await pool.query(unitQuery, [itemId]);
      units.push(unitResult.rows[0]);
    }

    res.status(201).json({
      message: `${quantity} unidad(es) creada(s) exitosamente`,
      units
    });

  } catch (error) {
    console.error('Error al crear unidades:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al crear las unidades'
    });
  }
};

// DELETE /orders/items/units/:unitId - Eliminar unidad
const deleteOrderItemUnit = async (req, res) => {
  try {
    const { unitId } = req.params;
    const tenant_id = req.user.tenant_id;

    // Verificar que la unidad existe y pertenece al tenant
    const unitQuery = `
      SELECT oiu.*, oi.order_id, o.tenant_id
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

    // Eliminar la unidad
    await pool.query('DELETE FROM order_item_units WHERE id = $1', [unitId]);

    res.json({
      message: 'Unidad eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar unidad:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al eliminar la unidad'
    });
  }
};

// PATCH /orders/items/units/:unitId - Cambiar estado de unidad
const updateOrderItemUnit = async (req, res) => {
  try {
    const { unitId } = req.params;
    const { status } = req.body;
    const tenant_id = req.user.tenant_id;

    // Validar estado
    const validStatuses = ['pending', 'preparing', 'ready', 'delivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Estado inválido',
        message: `Estado debe ser uno de: ${validStatuses.join(', ')}`
      });
    }

    // Verificar que la unidad existe y pertenece al tenant
    const unitQuery = `
      SELECT oiu.*, oi.order_id, o.tenant_id
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

    res.json({
      message: 'Estado de unidad actualizado exitosamente',
      unit: updateResult.rows[0]
    });

  } catch (error) {
    console.error('Error al actualizar unidad:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al actualizar la unidad'
    });
  }
};

// POST /orders/:id/close - Cerrar orden
const closeOrder = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const tenant_id = req.user.tenant_id;

    // Verificar que la orden existe y pertenece al tenant
    const orderQuery = `
      SELECT o.*, rt.id as table_id
      FROM orders o
      LEFT JOIN restaurant_tables rt ON o.table_id = rt.id
      WHERE o.id = $1 AND o.tenant_id = $2
    `;
    const orderResult = await pool.query(orderQuery, [orderId, tenant_id]);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Orden no encontrada',
        message: 'La orden especificada no existe'
      });
    }

    const order = orderResult.rows[0];

    if (order.status === 'completed' || order.status === 'cancelled') {
      return res.status(400).json({
        error: 'Orden ya cerrada',
        message: 'La orden ya ha sido cerrada'
      });
    }

    // Cerrar la orden
    await pool.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['completed', orderId]
    );

    // Liberar la mesa si existe
    if (order.table_id) {
      await pool.query(
        'UPDATE restaurant_tables SET status = $1 WHERE id = $2',
        ['available', order.table_id]
      );
    }

    res.json({
      message: 'Orden cerrada exitosamente'
    });

  } catch (error) {
    console.error('Error al cerrar orden:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al cerrar la orden'
    });
  }
};

// DELETE /orders/:id - Eliminar orden
const deleteOrder = async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const tenant_id = req.user.tenant_id;

    // Verificar que la orden existe y pertenece al tenant
    const orderQuery = `
      SELECT o.*, rt.id as table_id
      FROM orders o
      LEFT JOIN restaurant_tables rt ON o.table_id = rt.id
      WHERE o.id = $1 AND o.tenant_id = $2
    `;
    const orderResult = await pool.query(orderQuery, [orderId, tenant_id]);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Orden no encontrada',
        message: 'La orden especificada no existe'
      });
    }

    const order = orderResult.rows[0];

    if (order.status === 'completed') {
      return res.status(400).json({
        error: 'Orden no eliminable',
        message: 'No se puede eliminar una orden completada'
      });
    }

    // Liberar la mesa si existe
    if (order.table_id) {
      await pool.query(
        'UPDATE restaurant_tables SET status = $1 WHERE id = $2',
        ['available', order.table_id]
      );
    }

    // Eliminar la orden (cascada eliminará items y unidades)
    await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);

    res.json({
      message: 'Orden eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar orden:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al eliminar la orden'
    });
  }
};

// Función auxiliar para actualizar totales de orden
const updateOrderTotals = async (orderId) => {
  const totalsQuery = `
    SELECT 
      COALESCE(SUM(subtotal), 0) as subtotal,
      COALESCE(SUM(subtotal) * 0.19, 0) as tax
    FROM order_items 
    WHERE order_id = $1
  `;
  
  const totalsResult = await pool.query(totalsQuery, [orderId]);
  const { subtotal, tax } = totalsResult.rows[0];
  const total = parseFloat(subtotal) + parseFloat(tax);

  await pool.query(
    'UPDATE orders SET subtotal = $1, tax = $2, total = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
    [subtotal, tax, total, orderId]
  );
};

module.exports = {
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
}; 