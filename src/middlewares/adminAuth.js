const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || '5up3r_v1t3c';

function adminAuth(req, res, next) {
  console.log('🔐 ====== ADMIN AUTH DEBUG ======');
  
  const authHeader = req.header('Authorization');
  console.log('🔍 Authorization header:', authHeader);
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log(' No bearer token');
    return res.status(401).json({ mensaje: 'Falta token de autorización' });
  }

  const token = authHeader.replace('Bearer ', '');
  console.log('🔍 Token (primeros 20 chars):', token.substring(0, 20));
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('🔍 ====== TOKEN DECODED ======');
    console.log('🔍 decoded.id:', decoded.id);
    console.log('🔍 decoded.correo_electronico:', decoded.correo_electronico);
    console.log('🔍 decoded.rol:', decoded.rol);
    console.log('🔍 decoded.role:', decoded.role); // ← VERIFICA AMBOS
    console.log('🔍 Token completo decoded:', JSON.stringify(decoded, null, 2));
    
    const userRole = decoded.rol || decoded.role;
    console.log('🔍 userRole final:', userRole);
    
    if (!userRole || userRole !== 'admin') {
      console.log(' Rol inválido:', userRole);
      return res.status(403).json({ 
        mensaje: 'Acceso prohibido',
        rolRecibido: userRole  
      });
    }

    console.log(' Admin verificado correctamente');
    req.admin = decoded;
    next();
    
  } catch (e) {
    console.error(' Error verificando token:', e.message);
    return res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
}

module.exports = adminAuth;
