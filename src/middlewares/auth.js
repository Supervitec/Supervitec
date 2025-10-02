const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || '5up3r_v1t3c';

// Middleware principal de autenticación
const authMiddleware = (req, res, next) => {
  try {
    // Obtener el header de autorización
    const authHeader = req.headers.authorization;
    
    // Verificar que existe y tiene formato correcto
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado',
        code: 'NO_TOKEN'
      });
    }

    // Extraer el token 
    const token = authHeader.substring(7);
    
    if (!token || token.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Token vacío',
        code: 'EMPTY_TOKEN'
      });
    }
    
    // Verificar y decodificar el token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verificar que el token no esté expirado manualmente
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      return res.status(401).json({
        success: false,
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    
    req.user = decoded;
    
    
    next();
    
  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);
    
    // Manejo específico de errores JWT
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    // Error genérico
    return res.status(401).json({
      success: false,
      message: 'Error de autenticación',
      code: 'AUTH_ERROR'
    });
  }
};

// Middleware para verificar roles específicos
const requireRole = (roles) => {
  return (req, res, next) => {
    // Este middleware debe usarse DESPUÉS de authMiddleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    const userRole = req.user.rol;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Permisos insuficientes',
        required: allowedRoles,
        current: userRole
      });
    }

    next();
  };
};

// Middleware para verificar que el usuario existe en la BD
const verifyUserExists = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido - falta ID de usuario'
      });
    }

    const user = await User.findById(req.user.id).select('-contrasena');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (!user.activo) {
      return res.status(403).json({
        success: false,
        message: 'Usuario desactivado'
      });
    }

    // Agregar datos actualizados del usuario
    req.currentUser = user;
    next();

  } catch (error) {
    console.error('❌ Error verificando usuarios existentes:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// ✅ Middleware combinado para admin
const requireAdmin = [
  authMiddleware,
  requireRole(['admin'])
];

//  Exportar todos los middlewares
module.exports = {
  authMiddleware,
  requireRole,
  verifyUserExists,
  requireAdmin
};

// Exportación por defecto
module.exports = authMiddleware;
module.exports.requireRole = requireRole;
module.exports.verifyUserExists = verifyUserExists;
module.exports.requireAdmin = requireAdmin;
