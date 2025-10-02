const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || '5up3r_v1t3c';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'r3fr3sh_5up3r_v1t3c';

// Configuración de tiempos
const TOKEN_CONFIG = {
  ACCESS_TOKEN_EXPIRY: '15m',        // 15 minutos para operaciones
  REFRESH_TOKEN_EXPIRY: '7d',        // 7 días para renovar
  INACTIVITY_TIMEOUT: 30 * 60 * 1000, // 30 minutos de inactividad
  MAX_SESSION_TIME: 8 * 60 * 60 * 1000 // 8 horas máximo por sesión
};

// Generar Access Token
const generateAccessToken = (user) => {
  const tokenId = crypto.randomBytes(16).toString('hex');
  
  const payload = {
    id: user._id,
    correo_electronico: user.correo_electronico,
    rol: user.rol,
    nombre_completo: user.nombre_completo,
    tokenId: tokenId,
    tipo: 'access',
    iat: Math.floor(Date.now() / 1000)
  };

  return {
    token: jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY }),
    tokenId: tokenId,
    expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY
  };
};

// Generar Refresh Token
const generateRefreshToken = (user, tokenId) => {
  const payload = {
    id: user._id,
    tokenId: tokenId,
    tipo: 'refresh',
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY });
};

// Verificar Access Token
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Token inválido o expirado');
  }
};

// Verificar Refresh Token
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, REFRESH_SECRET);
  } catch (error) {
    throw new Error('Refresh token inválido o expirado');
  }
};

// Verificar inactividad
const checkInactivity = (lastActivity) => {
  const now = new Date();
  const inactiveTime = now - new Date(lastActivity);
  
  return {
    isInactive: inactiveTime > TOKEN_CONFIG.INACTIVITY_TIMEOUT,
    isExpiredSession: inactiveTime > TOKEN_CONFIG.MAX_SESSION_TIME,
    inactiveMinutes: Math.floor(inactiveTime / (1000 * 60))
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  checkInactivity,
  TOKEN_CONFIG
};
