const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Token de acceso requerido',
        message: 'Debe incluir el token en el header Authorization: Bearer <token>'
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Token inválido',
        message: 'El token no puede estar vacío'
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar que el usuario existe y está activo
    const userQuery = `
      SELECT id, tenant_id, username, email, first_name, last_name, role, is_active
      FROM users 
      WHERE id = $1 AND is_active = true
    `;
    
    const userResult = await pool.query(userQuery, [decoded.userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Usuario no encontrado o inactivo',
        message: 'El usuario no existe o ha sido desactivado'
      });
    }

    req.user = userResult.rows[0];
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Token inválido',
        message: 'El token proporcionado no es válido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expirado',
        message: 'El token ha expirado, inicie sesión nuevamente'
      });
    }
    
    console.error('Error en verificación de token:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: 'Error al verificar la autenticación'
    });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'No autenticado',
        message: 'Debe iniciar sesión primero'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Acceso denegado',
        message: `Su rol (${req.user.role}) no tiene permisos para esta acción. Roles permitidos: ${roles.join(', ')}`
      });
    }

    next();
  };
};

module.exports = {
  verifyToken,
  requireRole
}; 