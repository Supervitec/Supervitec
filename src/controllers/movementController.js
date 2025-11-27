const Movement = require('../models/Movement');
const mongoose = require('mongoose');

// =============================================================================
// HELPER: OBTENER USER ID SEGURO
// =============================================================================
const getUserId = (req) => {
  if (!req.user && !req.usuario) return null;
  return req.user?.id || req.user?._id || req.usuario?.id || req.usuario?._id;
};

// =============================================================================
// REGISTRAR NUEVO MOVIMIENTO (App Móvil)
// =============================================================================
exports.registerMovement = async (req, res) => {
  try {
    console.log('🟢 registerMovement ejecutado');
    
    // Obtener ID de forma segura
    let userId = req.body.user_id || getUserId(req);

    if (!userId) {
      console.error('❌ registerMovement: Usuario no autenticado o user_id faltante');
      return res.status(401).json({ success: false, mensaje: 'Usuario no autenticado' });
    }

    // Validar y convertir a ObjectId
    if (typeof userId === 'string') {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, mensaje: 'ID de usuario inválido' });
        }
        userId = new mongoose.Types.ObjectId(userId);
    }

    const {
      start_location,
      end_location,
      distancia_recorrida,
      velocidad_promedio,
      velocidad_maxima,
      tiempo_total,
      fecha,
      fecha_fin,
      region,
      tipo_movimiento,
      transporte_utilizado,
      ruta_seguida,
      observaciones,
      estado,
    } = req.body;

    // Validaciones básicas de datos obligatorios
    if (!start_location || !end_location || !fecha) {
      console.warn('⚠️ Faltan datos obligatorios en el registro');
      return res.status(400).json({ 
        success: false, 
        mensaje: 'Faltan datos obligatorios (ubicación o fecha)' 
      });
    }

    // Crear el movimiento
    const movement = new Movement({
      user_id: userId,
      start_location: {
        latitude: start_location.latitude,
        longitude: start_location.longitude,
        timestamp: start_location.timestamp || new Date(),
      },
      end_location: {
        latitude: end_location.latitude,
        longitude: end_location.longitude,
        timestamp: end_location.timestamp || new Date(),
      },
      distancia_recorrida: Number(distancia_recorrida) || 0,
      velocidad_promedio: Number(velocidad_promedio) || 0,
      velocidad_maxima: Number(velocidad_maxima) || 0,
      tiempo_total: Number(tiempo_total) || 0,
      fecha: new Date(fecha),
      fecha_fin: fecha_fin ? new Date(fecha_fin) : new Date(),
      region: region || 'Caldas',
      tipo_movimiento: tipo_movimiento || 'recorrido_seguridad',
      transporte_utilizado: transporte_utilizado || 'carro',
      estado: estado || 'completado',
      ruta_seguida: Array.isArray(ruta_seguida) ? ruta_seguida : [],
      observaciones: observaciones || '',
      activo: true
    });

    await movement.save();

    // Poblar datos básicos del usuario para la respuesta
    await movement.populate('user_id', 'nombre_completo correo_electronico region');

    console.log(`✅ Movimiento registrado: ${movement._id} (${movement.distancia_recorrida}m)`);

    res.status(201).json({
      success: true,
      mensaje: 'Movimiento registrado correctamente.',
      movement
    });

  } catch (error) {
    console.error('❌ Error en registerMovement:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error interno del servidor al registrar movimiento',
      error: error.message 
    });
  }
};

// Alias para compatibilidad
exports.createMovement = exports.registerMovement;


// =============================================================================
// OBTENER TODOS LOS MOVIMIENTOS (Dashboard)
// =============================================================================
exports.getAllMovements = async (req, res) => {
  try {
    const rawUserId = getUserId(req);
    
    if (!rawUserId) {
        return res.status(401).json({ success: false, mensaje: 'No autorizado' });
    }

    if (!mongoose.Types.ObjectId.isValid(rawUserId)) {
        return res.status(400).json({ success: false, mensaje: 'ID de usuario inválido' });
    }

    const userId = new mongoose.Types.ObjectId(rawUserId);
    
    // Paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    console.log(`📥 Obteniendo movimientos para: ${userId} (Página ${page})`);

    // Consultas en paralelo para optimizar
    const [movimientos, total] = await Promise.all([
      Movement.find({ user_id: userId, activo: true })
        .sort({ fecha: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Movement.countDocuments({ user_id: userId, activo: true })
    ]);

    console.log(`✅ ${movimientos.length} movimientos recuperados`);

    res.json({
      success: true,
      data: movimientos || [], // Estructura principal
      movimientos: movimientos || [], // Estructura legacy
      paginacion: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });

  } catch (error) {
    console.error('❌ Error en getAllMovements:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: 'Error obteniendo historial de movimientos',
      error: error.message 
    });
  }
};


// =============================================================================
// OBTENER MOVIMIENTOS POR FECHA (Estadísticas Diarias)
// =============================================================================
exports.getMovementsByDate = async (req, res) => {
  try {
    const rawUserId = getUserId(req);
    if (!rawUserId) return res.status(401).json({ success: false, mensaje: 'No autorizado' });

    const userId = new mongoose.Types.ObjectId(rawUserId);
    const fechaStr = req.params.date;
    
    // Crear rango de fechas (todo el día)
    const startOfDay = new Date(fechaStr);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(fechaStr);
    endOfDay.setHours(23, 59, 59, 999);

    if (isNaN(startOfDay.getTime())) {
        return res.status(400).json({ success: false, mensaje: 'Fecha inválida' });
    }

    console.log(`📅 Consultando fecha: ${fechaStr}`);

    const movimientos = await Movement.find({
        user_id: userId,
        activo: true,
        fecha: { $gte: startOfDay, $lte: endOfDay }
    }).lean();

    // Calcular estadísticas simples
    const stats = movimientos.reduce((acc, mov) => ({
        totalDistancia: acc.totalDistancia + (mov.distancia_recorrida || 0),
        maxVelMaxima: Math.max(acc.maxVelMaxima, mov.velocidad_maxima || 0),
        totalRecorridos: acc.totalRecorridos + 1,
        avgVelPromedio: acc.avgVelPromedio + (mov.velocidad_promedio || 0)
    }), { totalDistancia: 0, maxVelMaxima: 0, totalRecorridos: 0, avgVelPromedio: 0 });

    if (stats.totalRecorridos > 0) {
        stats.avgVelPromedio = stats.avgVelPromedio / stats.totalRecorridos;
    }

    res.json({
        success: true,
        fecha: fechaStr,
        ...stats,
        movimientos
    });

  } catch (error) {
    console.error('❌ Error en getMovementsByDate:', error);
    res.status(500).json({ success: false, mensaje: 'Error en consulta por fecha', error: error.message });
  }
};


// =============================================================================
// OBTENER HISTORIAL MENSUAL
// =============================================================================
exports.getMovementsByMonth = async (req, res) => {
  try {
    const rawUserId = getUserId(req);
    if (!rawUserId) return res.status(401).json({ success: false, mensaje: 'No autorizado' });

    const userId = new mongoose.Types.ObjectId(rawUserId);
    const month = parseInt(req.params.month) - 1; // Base 0
    const year = parseInt(req.params.year);
    
    const firstDay = new Date(year, month, 1);
    const nextMonth = new Date(year, month + 1, 1);

    if (isNaN(firstDay.getTime())) {
        return res.status(400).json({ success: false, mensaje: 'Fecha inválida' });
    }

    console.log(`📆 Consultando mes: ${month + 1}/${year}`);

    // Usar aggregate para estadísticas eficientes
    const movimientos = await Movement.aggregate([
      { 
        $match: {
          user_id: userId,
          fecha: { $gte: firstDay, $lt: nextMonth },
          activo: true
        }
      },
      { 
        $group: {
          _id: null,
          totalRecorridos: { $sum: 1 },
          totalDistancia: { $sum: "$distancia_recorrida" },
          avgVelPromedio: { $avg: "$velocidad_promedio" },
          maxVelMaxima: { $max: "$velocidad_maxima" },
          locations: { $push: "$start_location" }
        }
      }
    ]);

    const resultado = movimientos[0] || {
      totalRecorridos: 0,
      totalDistancia: 0,
      avgVelPromedio: 0,
      maxVelMaxima: 0,
      locations: []
    };

    res.json({
      success: true,
      mes: month + 1,
      año: year,
      ...resultado
    });

  } catch (error) {
    console.error('❌ Error en getMovementsByMonth:', error);
    res.status(500).json({ success: false, mensaje: 'Error en consulta mensual', error: error.message });
  }
};

module.exports = exports;
