const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || '5up3r_v1t3c';

function adminAuth(req, res, next) {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ mensaje: 'Falta token de autorización' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.role || decoded.role !== 'admin') {
      return res.status(403).json({ mensaje: 'Acceso prohibido' });
    }
    
    req.admin = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
}

module.exports = adminAuth;

