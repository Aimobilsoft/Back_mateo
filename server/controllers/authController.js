const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const login = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validar campos requeridos
    if (!password || (!username && !email)) {
      return res.status(400).json({
        error: 'Campos requeridos',
        message: 'Username/Email y password son obligatorios'
      });
    }

    // Buscar usuario por username o email
    const userQuery = `
      SELECT u.*, t.name as tenant_name 
      FROM users u 
      JOIN tenants t ON u.tenant_id = t.id 
      WHERE (u.username = $1 OR u.email = $1) AND u.is_active = true
    `;
    
    const userResult = await pool.query(userQuery, [username || email]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Username o password incorrectos'
      });
    }

    const user = userResult.rows[0];

    // Verificar password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Username o password incorrectos'
      });
    }

    // Generar token JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        tenantId: user.tenant_id,
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Remover password de la respuesta
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login exitoso',
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al procesar el login'
    });
  }
};

const register = async (req, res) => {
  try {
    const { 
      tenant_id, 
      username, 
      email, 
      password, 
      first_name, 
      last_name, 
      role 
    } = req.body;

    // Validar campos requeridos
    if (!tenant_id || !username || !email || !password || !role) {
      return res.status(400).json({
        error: 'Campos requeridos',
        message: 'tenant_id, username, email, password y role son obligatorios'
      });
    }

    // Validar rol
    const validRoles = ['admin', 'waiter', 'kitchen', 'cashier'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Rol inválido',
        message: `Rol debe ser uno de: ${validRoles.join(', ')}`
      });
    }

    // Verificar que el tenant existe
    const tenantQuery = 'SELECT id FROM tenants WHERE id = $1';
    const tenantResult = await pool.query(tenantQuery, [tenant_id]);
    
    if (tenantResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Tenant no encontrado',
        message: 'El tenant_id proporcionado no existe'
      });
    }

    // Verificar que username no existe
    const existingUserQuery = 'SELECT id FROM users WHERE username = $1';
    const existingUserResult = await pool.query(existingUserQuery, [username]);
    
    if (existingUserResult.rows.length > 0) {
      return res.status(400).json({
        error: 'Username ya existe',
        message: 'El username ya está en uso'
      });
    }

    // Verificar que email no existe
    const existingEmailQuery = 'SELECT id FROM users WHERE email = $1';
    const existingEmailResult = await pool.query(existingEmailQuery, [email]);
    
    if (existingEmailResult.rows.length > 0) {
      return res.status(400).json({
        error: 'Email ya existe',
        message: 'El email ya está registrado'
      });
    }

    // Encriptar password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Crear usuario
    const insertQuery = `
      INSERT INTO users (tenant_id, username, email, password, first_name, last_name, role)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, tenant_id, username, email, first_name, last_name, role, is_active, created_at
    `;
    
    const insertResult = await pool.query(insertQuery, [
      tenant_id, username, email, hashedPassword, first_name, last_name, role
    ]);

    const newUser = insertResult.rows[0];

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: newUser
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al registrar el usuario'
    });
  }
};

const getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userQuery = `
      SELECT u.*, t.name as tenant_name 
      FROM users u 
      JOIN tenants t ON u.tenant_id = t.id 
      WHERE u.id = $1
    `;
    
    const userResult = await pool.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario no existe'
      });
    }

    const user = userResult.rows[0];
    const { password, ...userWithoutPassword } = user;

    res.json({
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al obtener información del usuario'
    });
  }
};

module.exports = {
  login,
  register,
  getMe
}; 