const express = require('express');
const { login, register, getMe } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// POST /auth/login
router.post('/login', login);

// POST /auth/register
router.post('/register', register);

// GET /auth/me - Obtener información del usuario actual
router.get('/me', verifyToken, getMe);

module.exports = router; 