const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth');
const Movement = require('../models/Movement');
const User = require('../models/User');

//  Middleware para validar ObjectId
function validateObjectId(req, res, next) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ 
      success: false, 
      message: 'ID inválido' 
    });
  }
  next();
}

//  POST /api/v1/movements - Registrar nuevo movimiento
router.post('/', authMiddleware, async (req, res) => {
  try {
    console.log('📍 POST /movements - Request recibido');
    console.log('👤 Usuario autenticado:', req.user?.id);
    console.log('📦 Body completo:', JSON.stringify(req.body, null, 2));
    
    const {
      user_id,                
      tipo_movimiento,
      start_location,
      end_location,           
      distancia_recorrida,    
      velocidad_promedio,     
      velocidad_maxima,       
      tiempo_total,           
      fecha,                  
      fecha_fin,              
      observaciones,
      region,
      transporte_utilizado,
      ruta_seguida,           
      estado,                 
    } = req.body;

    // DETERMINAR user_id 
    const userId = user_id || req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'user_id es requerido'
      });
    }

    // Validar datos requeridos
    if (!start_location || !start_location.latitude || !start_location.longitude) {
      return res.status(400).json({
        success: false,
        message: 'Ubicación de inicio requerida (latitude, longitude)'
      });
    }

    // VALIDAR end_location SI SE PROPORCIONA
    if (end_location && (!end_location.latitude || !end_location.longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Ubicación de fin incompleta (falta latitude o longitude)'
      });
    }

    // VALIDAR REGIÓN
    const regionesValidas = ['Caldas', 'Risaralda', 'Quindío'];
    const regionFinal = region || 'Caldas';
    
    if (!regionesValidas.includes(regionFinal)) {
      return res.status(400).json({
        success: false,
        message: `Región inválida. Debe ser: ${regionesValidas.join(', ')}`
      });
    }

    // Obtener datos del usuario para defaults
    const usuario = await User.findById(userId);
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // LOG ANTES DE CREAR
    console.log('💾 Creando movimiento con:');
    console.log('  - user_id:', userId);
    console.log('  - distancia_recorrida:', distancia_recorrida, 'metros');
    console.log('  - velocidad_maxima:', velocidad_maxima, 'km/h');
    console.log('  - velocidad_promedio:', velocidad_promedio, 'km/h');
    console.log('  - tiempo_total:', tiempo_total, 'minutos');
    console.log('  - region:', regionFinal);
    console.log('  - ruta_seguida:', ruta_seguida?.length || 0, 'puntos');

    // CREAR MOVIMIENTO CON TODOS LOS CAMPOS
    const nuevoMovimiento = new Movement({
      user_id: userId,
      
      // Ubicaciones
      start_location: {
        latitude: start_location.latitude,
        longitude: start_location.longitude,
        timestamp: start_location.timestamp || fecha || new Date(),
        direccion: start_location.direccion
      },
      end_location: end_location ? {
        latitude: end_location.latitude,
        longitude: end_location.longitude,
        timestamp: end_location.timestamp || fecha_fin || new Date(),
        direccion: end_location.direccion
      } : undefined,
      
      // DATOS NUMÉRICOS (ASEGURAR QUE SEAN NÚMEROS)
      distancia_recorrida: Number(distancia_recorrida) || 0,
      velocidad_promedio: Number(velocidad_promedio) || 0,
      velocidad_maxima: Number(velocidad_maxima) || 0,
      tiempo_total: Number(tiempo_total) || 0,
      
      // Fechas
      fecha: fecha ? new Date(fecha) : new Date(),
      fecha_fin: fecha_fin ? new Date(fecha_fin) : (end_location?.timestamp ? new Date(end_location.timestamp) : undefined),
      
      // Región y tipo
      region: regionFinal,
      tipo_movimiento: tipo_movimiento || 'recorrido_seguridad',
      transporte_utilizado: transporte_utilizado || usuario.transporte || 'carro',
      estado: estado || (end_location ? 'completado' : 'iniciado'),
      
      // RUTA SEGUIDA (opcional)
      ruta_seguida: ruta_seguida || [],
      
      // Observaciones
      observaciones: observaciones || '',
    });

    const movimientoGuardado = await nuevoMovimiento.save();
    await movimientoGuardado.populate('user_id', 'nombre_completo correo_electronico');

    // LOG DESPUÉS DE GUARDAR
    console.log('Movimiento guardado exitosamente:', {
      id: movimientoGuardado._id,
      distancia: movimientoGuardado.distancia_recorrida,
      velocidad_max: movimientoGuardado.velocidad_maxima,
      tiempo: movimientoGuardado.tiempo_total,
      region: movimientoGuardado.region,
    });

    res.status(201).json({
      success: true,
      message: 'Movimiento registrado exitosamente',
      data: movimientoGuardado
    });

  } catch (error) {
    console.error('❌ Error registrando movimiento:', error);
    console.error('📋 Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

//  GET /api/v1/movements/daily/:date - Movimientos por día 
router.get('/daily/:date', authMiddleware, async (req, res) => {
  try {
    const { date } = req.params;
    console.log('📅 Obteniendo movimientos del día:', date);

    // Validar formato de fecha
    const fechaConsulta = new Date(date);
    if (isNaN(fechaConsulta.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Formato de fecha inválido. Use YYYY-MM-DD'
      });
    }

    // Calcular rango del día
    const inicioDelDia = new Date(fechaConsulta);
    inicioDelDia.setHours(0, 0, 0, 0);
    
    const finDelDia = new Date(fechaConsulta);
    finDelDia.setHours(23, 59, 59, 999);

    // Construir filtros
    const filtros = {
      fecha: {
        $gte: inicioDelDia,
        $lte: finDelDia
      },
      activo: true
    };

    // Si no es admin, solo sus movimientos
    if (req.user.rol !== 'admin') {
      filtros.user_id = req.user.id;
    }

    const movimientos = await Movement.find(filtros)
      .populate('user_id', 'nombre_completo correo_electronico region')
      .sort({ fecha: -1 });

    console.log(` ${movimientos.length} movimientos encontrados para ${date}`);

    res.json({
      success: true,
      data: movimientos,
      fecha_consultada: date,
      total: movimientos.length
    });

  } catch (error) {
    console.error(' Error obteniendo movimientos diarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

//  GET /api/v1/movements/monthly/:month/:year - Movimientos por mes (manteniendo tu ruta)
router.get('/monthly/:month/:year', authMiddleware, async (req, res) => {
  try {
    const { month, year } = req.params;
    console.log(`📅 Obteniendo movimientos de ${month}/${year}`);

    // Validar parámetros
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    
    if (monthNum < 1 || monthNum > 12 || yearNum < 2020 || yearNum > 2030) {
      return res.status(400).json({
        success: false,
        message: 'Mes (1-12) o año inválido'
      });
    }

    // Calcular rango del mes
    const inicioDelMes = new Date(yearNum, monthNum - 1, 1);
    const finDelMes = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);

    const filtros = {
      fecha: {
        $gte: inicioDelMes,
        $lte: finDelMes
      },
      activo: true
    };

    // Si no es admin, solo sus movimientos
    if (req.user.rol !== 'admin') {
      filtros.user_id = req.user.id;
    }

    const movimientos = await Movement.find(filtros)
      .populate('user_id', 'nombre_completo correo_electronico region')
      .sort({ fecha: -1 });

    //  AGREGADO: Estadísticas del mes
    const estadisticas = {
      total_movimientos: movimientos.length,
      distancia_total: movimientos.reduce((acc, mov) => acc + (mov.distancia_recorrida || 0), 0),
      tiempo_total: movimientos.reduce((acc, mov) => acc + (mov.tiempo_total || 0), 0),
      movimientos_completados: movimientos.filter(m => m.estado === 'completado').length,
      incidentes_reportados: movimientos.reduce((acc, mov) => acc + (mov.incidentes?.length || 0), 0)
    };

    console.log(` ${movimientos.length} movimientos encontrados para ${month}/${year}`);

    res.json({
      success: true,
      data: movimientos,
      estadisticas,
      periodo: `${month}/${year}`,
      total: movimientos.length
    });

  } catch (error) {
    console.error(' Error obteniendo movimientos mensuales:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

//  AGREGADO: GET /api/v1/movements - Obtener todos los movimientos (ADMIN)
router.get('/', authMiddleware, async (req, res) => {
  try {
    console.log('📋 Obteniendo movimientos - Usuario:', req.user.rol);

    const { page = 1, limit = 10, estado, region } = req.query;
    
    // Construir filtros
    const filtros = { activo: true };
    if (estado) filtros.estado = estado;
    if (region) filtros.region = region;

    // Si no es admin, solo sus movimientos
    if (req.user.rol !== 'admin') {
      filtros.user_id = req.user.id;
    }

    // Paginación
    const skip = (page - 1) * limit;

    const movimientos = await Movement.find(filtros)
      .populate('user_id', 'nombre_completo correo_electronico region rol')
      .sort({ fecha: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Movement.countDocuments(filtros);

    res.json({
      success: true,
      data: movimientos,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_records: total
      }
    });

  } catch (error) {
    console.error(' Error obteniendo movimientos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

//  AGREGADO: PATCH /api/v1/movements/:id - Actualizar movimiento
router.patch('/:id', authMiddleware, validateObjectId, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔄 Actualizando movimiento:', id);

    const movimiento = await Movement.findById(id);
    
    if (!movimiento) {
      return res.status(404).json({
        success: false,
        message: 'Movimiento no encontrado'
      });
    }

    // Verificar permisos
    if (req.user.id !== movimiento.user_id.toString() && req.user.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para actualizar este movimiento'
      });
    }

    const {
      estado,
      end_location,
      observaciones,
      distancia_recorrida,
      velocidad_maxima,
      velocidad_promedio,
      incidentes,
      ruta_seguida
    } = req.body;

    // Si se está completando el movimiento
    if (estado === 'completado' && movimiento.estado !== 'completado') {
      movimiento.fecha_fin = new Date();
      movimiento.calcularDuracion();
    }

    // Actualizar campos
    if (estado) movimiento.estado = estado;
    if (end_location) movimiento.end_location = {
      ...end_location,
      timestamp: new Date()
    };
    if (observaciones) movimiento.observaciones = observaciones;
    if (distancia_recorrida) movimiento.distancia_recorrida = distancia_recorrida;
    if (velocidad_maxima) movimiento.velocidad_maxima = velocidad_maxima;
    if (velocidad_promedio) movimiento.velocidad_promedio = velocidad_promedio;
    if (incidentes) movimiento.incidentes = incidentes;
    if (ruta_seguida) movimiento.ruta_seguida = ruta_seguida;

    const movimientoActualizado = await movimiento.save();
    await movimientoActualizado.populate('user_id', 'nombre_completo correo_electronico');

    console.log(' Movimiento actualizado:', movimientoActualizado.estado);

    res.json({
      success: true,
      message: 'Movimiento actualizado correctamente',
      data: movimientoActualizado
    });

  } catch (error) {
    console.error(' Error actualizando movimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

//  AGREGADO: DELETE /api/v1/movements/:id - Eliminar movimiento
router.delete('/:id', authMiddleware, validateObjectId, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Eliminando movimiento:', id);

    // Solo admins pueden eliminar
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo administradores pueden eliminar movimientos'
      });
    }

    const movimiento = await Movement.findById(id);
    
    if (!movimiento) {
      return res.status(404).json({
        success: false,
        message: 'Movimiento no encontrado'
      });
    }

    // Soft delete
    movimiento.activo = false;
    await movimiento.save();

    res.json({
      success: true,
      message: 'Movimiento eliminado correctamente'
    });

  } catch (error) {
    console.error(' Error eliminando movimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;
