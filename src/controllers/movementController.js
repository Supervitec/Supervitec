const Movement = require('../models/Movement');
const mongoose = require('mongoose');

// Registrar nuevo movimiento al finalizar trayecto
exports.registerMovement = async (req, res) => {
  try {
    const {
      user_id,               // ✅ RECIBIR user_id del body (de backgroundLocationService)
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

    console.log('📥 Datos recibidos en backend:', {
      user_id: user_id || req.user?.id,
      region,
      distancia_recorrida,
      velocidad_promedio,
      velocidad_maxima,
      tiempo_total,
      tipo_movimiento,
      transporte_utilizado,
      estado,
      ruta_seguida_length: ruta_seguida?.length || 0,
    });

    // ✅ OBTENER USER_ID (puede venir del body o del token)
    const userId = user_id || req.user?.id;
    
    if (!userId) {
      console.error('❌ user_id no proporcionado');
      return res.status(400).json({ 
        success: false,
        mensaje: 'user_id es requerido' 
      });
    }

    // Validar campos obligatorios
    if (
      !start_location ||
      !end_location ||
      distancia_recorrida === undefined ||
      velocidad_promedio === undefined ||
      velocidad_maxima === undefined ||
      tiempo_total === undefined ||
      !fecha ||
      !region
    ) {
      console.error('❌ Datos incompletos recibidos');
      return res.status(400).json({ 
        success: false,
        mensaje: 'Datos de movimiento incompletos.',
        campos_faltantes: {
          start_location: !start_location,
          end_location: !end_location,
          distancia_recorrida: distancia_recorrida === undefined,
          velocidad_promedio: velocidad_promedio === undefined,
          velocidad_maxima: velocidad_maxima === undefined,
          tiempo_total: tiempo_total === undefined,
          fecha: !fecha,
          region: !region,
        }
      });
    }

    // ✅ VALIDAR QUE LOS VALORES NO SEAN NEGATIVOS
    if (distancia_recorrida < 0) {
      console.error('❌ distancia_recorrida es negativa:', distancia_recorrida);
      return res.status(400).json({
        success: false,
        mensaje: 'distancia_recorrida no puede ser negativa'
      });
    }

    if (velocidad_maxima < 0) {
      console.error('❌ velocidad_maxima es negativa:', velocidad_maxima);
      return res.status(400).json({
        success: false,
        mensaje: 'velocidad_maxima no puede ser negativa'
      });
    }

    if (tiempo_total < 0) {
      console.error('❌ tiempo_total es negativo:', tiempo_total);
      return res.status(400).json({
        success: false,
        mensaje: 'tiempo_total no puede ser negativo'
      });
    }

    // ✅ ADVERTENCIA SI LOS VALORES SON 0 (pero permitir guardar)
    if (distancia_recorrida === 0) {
      console.warn('⚠️ distancia_recorrida es 0 - se guardará de todos modos');
    }

    // ✅ Validar región (debe ser uno de los 3 permitidos)
    const regionesValidas = ['Caldas', 'Risaralda', 'Quindío'];
    if (!regionesValidas.includes(region)) {
      console.error('❌ Región inválida:', region);
      return res.status(400).json({
        success: false,
        mensaje: `Región inválida. Debe ser: ${regionesValidas.join(', ')}`
      });
    }

    // ✅ LOG DETALLADO ANTES DE CREAR
    console.log('💾 Creando movimiento con valores:');
    console.log('  - user_id:', userId);
    console.log('  - distancia_recorrida:', distancia_recorrida, 'metros (', (distancia_recorrida / 1000).toFixed(2), 'km)');
    console.log('  - velocidad_promedio:', velocidad_promedio, 'km/h');
    console.log('  - velocidad_maxima:', velocidad_maxima, 'km/h');
    console.log('  - tiempo_total:', tiempo_total, 'minutos');
    console.log('  - region:', region);
    console.log('  - tipo_movimiento:', tipo_movimiento || 'recorrido_seguridad');
    console.log('  - transporte_utilizado:', transporte_utilizado || 'carro');
    console.log('  - estado:', estado || 'completado');
    console.log('  - ruta_seguida:', ruta_seguida?.length || 0, 'puntos');

    // ✅ CONVERTIR A OBJECTID SI ES NECESARIO
    let userObjectId;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      userObjectId = new mongoose.Types.ObjectId(userId);
    } else {
      console.error('❌ user_id no es un ObjectId válido:', userId);
      return res.status(400).json({
        success: false,
        mensaje: 'user_id no es válido'
      });
    }

    // Crear movimiento con todos los campos
    const movement = new Movement({
      user_id: userObjectId, // ✅ ObjectId convertido
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
      distancia_recorrida: Number(distancia_recorrida), // ✅ Asegurar que sea número
      velocidad_promedio: Number(velocidad_promedio),
      velocidad_maxima: Number(velocidad_maxima),
      tiempo_total: Number(tiempo_total),
      fecha: new Date(fecha),
      fecha_fin: fecha_fin ? new Date(fecha_fin) : (end_location?.timestamp ? new Date(end_location.timestamp) : new Date()),
      region,
      
      // ✅ CAMPOS REQUERIDOS POR EL MODELO
      tipo_movimiento: tipo_movimiento || 'recorrido_seguridad',
      transporte_utilizado: transporte_utilizado || 'carro',
      estado: estado || 'completado',
      
      // ✅ CAMPOS OPCIONALES
      ruta_seguida: ruta_seguida || [],
      observaciones: observaciones || '',
    });

    // ✅ LOG ANTES DE GUARDAR
    console.log('🔍 Movimiento antes de save():', {
      user_id: movement.user_id,
      distancia_recorrida: movement.distancia_recorrida,
      velocidad_promedio: movement.velocidad_promedio,
      velocidad_maxima: movement.velocidad_maxima,
      tiempo_total: movement.tiempo_total,
      region: movement.region,
      ruta_seguida_length: movement.ruta_seguida.length,
    });

    await movement.save();

    // ✅ LOG DESPUÉS DE GUARDAR
    console.log('✅ Movimiento guardado en DB:', {
      id: movement._id,
      distancia: movement.distancia_recorrida,
      velocidad_max: movement.velocidad_maxima,
      tiempo: movement.tiempo_total,
    });

    // ✅ Poblar usuario para devolver nombre completo
    await movement.populate('user_id', 'nombre_completo correo_electronico region');

    console.log(`✅ Movimiento registrado exitosamente:`, {
      id: movement._id,
      usuario: movement.user_id?.nombre_completo,
      distancia: movement.distancia_recorrida,
      velocidad_maxima: movement.velocidad_maxima,
      region: movement.region
    });

    res.status(201).json({
      success: true,
      mensaje: 'Movimiento registrado correctamente.',
      movement
    });

  } catch (error) {
    console.error('❌ Error al registrar movimiento:', error);
    console.error('📋 Stack trace:', error.stack);
    
    // ✅ MEJOR MANEJO DE ERRORES
    if (error.name === 'ValidationError') {
      const errores = Object.keys(error.errors).map(key => ({
        campo: key,
        mensaje: error.errors[key].message
      }));
      
      return res.status(400).json({ 
        success: false,
        mensaje: 'Error de validación',
        errores
      });
    }
    
    res.status(500).json({ 
      success: false,
      mensaje: 'Error en el servidor', 
      error: error.message 
    });
  }
};

// Consultar movimientos diarios del usuario
exports.getMovementsByDate = async (req, res) => {
  try {
    const fechaStr = req.params.date;
    const fecha = new Date(fechaStr);
    const nextDay = new Date(fechaStr);
    nextDay.setDate(nextDay.getDate() + 1);

    // ✅ CONVERTIR A OBJECTID
    const userId = new mongoose.Types.ObjectId(req.user.id);

    console.log(`📅 Obteniendo movimientos del día: ${fechaStr} para usuario: ${userId}`);

    const movimientos = await Movement.aggregate([
      { 
        $match: { 
          user_id: userId, // ✅ ObjectId
          fecha: { $gte: fecha, $lt: nextDay },
          activo: true // ✅ Solo movimientos activos
        } 
      },
      { 
        $group: {
          _id: null,
          totalRecorridos: { $sum: 1 },
          totalDistancia: { $sum: "$distancia_recorrida" },
          avgVelPromedio: { $avg: "$velocidad_promedio" },
          maxVelMaxima: { $max: "$velocidad_maxima" },
          movimientos: { $push: "$$ROOT" }
        }
      }
    ]);

    const resultado = movimientos[0] || { 
      totalRecorridos: 0, 
      totalDistancia: 0, 
      avgVelPromedio: 0, 
      maxVelMaxima: 0, 
      movimientos: [] 
    };

    console.log(`✅ ${resultado.totalRecorridos} movimientos encontrados para ${fechaStr}`);

    res.json({
      success: true,
      fecha: fechaStr,
      ...resultado
    });
  } catch (error) {
    console.error('❌ Error al obtener movimientos por fecha:', error);
    res.status(500).json({ 
      success: false,
      mensaje: 'Error en el servidor', 
      error: error.message 
    });
  }
};

// Consultar historial mensual del usuario
exports.getMovementsByMonth = async (req, res) => {
  try {
    const month = parseInt(req.params.month) - 1; // Mes base 0
    const year = parseInt(req.params.year);
    const firstDay = new Date(year, month, 1);
    const nextMonth = new Date(year, month + 1, 1);

    // ✅ CONVERTIR A OBJECTID
    const userId = new mongoose.Types.ObjectId(req.user.id);

    console.log(`📆 Obteniendo movimientos del mes ${month + 1}/${year} para usuario: ${userId}`);

    const movimientos = await Movement.aggregate([
      { 
        $match: {
          user_id: userId, // ✅ ObjectId
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

    console.log(`✅ ${resultado.totalRecorridos} movimientos encontrados para ${month + 1}/${year}`);

    res.json({
      success: true,
      mes: month + 1,
      año: year,
      ...resultado
    });
  } catch (error) {
    console.error('❌ Error al obtener movimientos por mes:', error);
    res.status(500).json({ 
      success: false,
      mensaje: 'Error en el servidor', 
      error: error.message 
    });
  }
};

// ✅ NUEVO: Obtener todos los movimientos del usuario (para historial completo)
exports.getAllMovements = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    console.log(`📋 Obteniendo movimientos del usuario: ${userId} (página ${page})`);

    const [movimientos, total] = await Promise.all([
      Movement.find({ user_id: userId, activo: true })
        .sort({ fecha: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Movement.countDocuments({ user_id: userId, activo: true })
    ]);

    console.log(`✅ ${movimientos.length} movimientos encontrados (total: ${total})`);

    res.json({
      success: true,
      movimientos,
      paginacion: {
        total,
        pagina: page,
        totalPaginas: Math.ceil(total / limit),
        limite: limit
      }
    });
  } catch (error) {
    console.error('❌ Error al obtener movimientos:', error);
    res.status(500).json({ 
      success: false,
      mensaje: 'Error en el servidor', 
      error: error.message 
    });
  }
};

module.exports = exports;
