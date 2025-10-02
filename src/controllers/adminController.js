const Admin = require('../models/admin');
const User = require('../models/User');
const Movement = require('../models/Movement');
const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');

const JWT_SECRET = process.env.JWT_SECRET || '5up3r_v1t3c';
const REFRESH_SECRET = process.env.REFRESH_SECRET || '5up3r_v1t3c';


// Login del administrador
exports.adminLogin = async (req, res) => {
  try {
    const { correo_electronico, contrasena } = req.body;

    if (!correo_electronico || !contrasena) {
      return res.status(400).json({ mensaje: 'Correo y contraseña obligatorios' });
    }

    const admin = await Admin.findOne({ correo_electronico });
    if (!admin) return res.status(400).json({ mensaje: 'Correo o contraseña incorrectos' });

    const isMatch = await admin.comparecontrasena(contrasena);
    if (!isMatch) return res.status(400).json({ mensaje: 'Correo o contraseña incorrectos' });

    // Genera tokens
    const payload = { id: admin._id, correo_electronico: admin.correo_electronico, role: 'admin' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
    const refresh_token = jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });

    res.json({ 
      token, 
      refresh_token,  // Agregado
      correo_electronico: admin.correo_electronico 
    });
  } catch (e) {
    console.error('Error login admin:', e);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};

// Middleware para proteger rutas admin (igual, ok)
exports.adminAuth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ mensaje: 'Falta token de autorización' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') throw new Error('No es admin');
    req.admin = decoded;
    next();
  } catch (e) {
    res.status(403).json({ mensaje: 'Acceso denegado' });
  }
};

// Consultar usuarios con filtro opcional por región
exports.getUsers = async (req, res) => {
  try {
    const { region } = req.query;
    const query = region ? { region } : {};
    const users = await User.find(query).select('-contrasena');
    res.json(users);
  } catch (error) {
    console.error('Error obtener usuarios:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};

// Consultar movimientos con filtro opcional por usuario
exports.getMovements = async (req, res) => {
  try {
    const { Usuario } = req.query;
    const query = Usuario ? { Usuario } : {};
    const movements = await Movement.find(query);
    res.json(movements);
  } catch (error) {
    console.error('Error obtener movimientos:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};

// Actualizar usuario (solo campos permitidos)
exports.actualizarUsuario = async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;

    const camposPermitidos = ['nombre_completo', 'correo_electronico'];
    const actualizacionesFiltradas = {};
    camposPermitidos.forEach(campo => {
      if (updates[campo] !== undefined) {
        actualizacionesFiltradas[campo] = updates[campo];
      }
    });

    const usuarioActualizado = await User.findByIdAndUpdate(id, actualizacionesFiltradas, { new: true });
    if (!usuarioActualizado) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    res.json({ mensaje: 'Usuario actualizado', usuario: usuarioActualizado });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};

// Actualizar movimiento (solo campos permitidos)
exports.actualizarMovimiento = async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    const camposPermitidos = ['distancia_recorrida', 'velocidad_promedio', 'velocidad_maxima', 'tiempo_total', 'fecha', 'region'];  // Alineado con Movement.js
    const actualizacionesFiltradas = {};
    camposPermitidos.forEach(campo => {
      if (updates[campo] !== undefined) {
        actualizacionesFiltradas[campo] = updates[campo];
      }
    });
    const movimientoActualizado = await Movement.findByIdAndUpdate(id, actualizacionesFiltradas, { new: true });
    if (!movimientoActualizado) {
      return res.status(404).json({ mensaje: 'Movimiento no encontrado' });
    }
    res.json({ mensaje: 'Movimiento actualizado', movimiento: movimientoActualizado });
  } catch (error) {
    console.error('Error al actualizar movimiento:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};

// Eliminar usuario
exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Usuario eliminado exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};

// Eliminar movimiento
exports.deleteMovement = async (req, res) => {
  try {
    await Movement.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Movimiento eliminado exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar movimiento:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};

// Exportar movimientos a Excel
exports.exportMovements = async (req, res) => {
  try {
    const { month, year, region } = req.params;

    const match = {
      fecha: {
        $gte: new Date(parseInt(year), parseInt(month) - 1, 1),
        $lt: new Date(parseInt(year), parseInt(month), 1),
      }
    };
    if (region) match.region = region;

    const data = await Movement.find(match)
      .populate('user_id', 'nombre_completo correo_electronico region transporte rol')
      .lean();

    const records = data.map(mov => ({
      Usuario: mov.user_id.nombre_completo,
      Correo: mov.user_id.correo_electronico,
      Región: mov.region,
      Transporte: mov.user_id.transporte,
      Rol: mov.user_id.rol,
      Fecha: mov.fecha.toISOString().substring(0, 10),
      Distancia_km: mov.distancia_recorrida,
      Velocidad_promedio_kmh: mov.velocidad_promedio,
      Velocidad_maxima_kmh: mov.velocidad_maxima,
      Tiempo_minutos: mov.tiempo_total
    }));

    const ws = XLSX.utils.json_to_sheet(records);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimientos");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader('Content-Disposition', 'attachment; filename=movimientos.xlsx');
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('Error exportando movimientos:', err);
    res.status(500).json({ mensaje: 'Error al exportar', error: err.message });
  }
};
