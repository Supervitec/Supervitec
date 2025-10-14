const Movement = require('../models/Movement');

// Registrar nuevo movimiento al finalizar trayecto
exports.registerMovement = async (req, res) => {
  try {
    const {
      start_location,
      end_location,
      distancia_recorrida,
      velocidad_promedio,
      velocidad_maxima,
      tiempo_total,
      fecha,
      region,
      tipo_movimiento,        // ✅ NUEVO
      transporte_utilizado,   // ✅ NUEVO
      ruta_seguida,          // ✅ NUEVO (opcional)
      observaciones,         // ✅ NUEVO (opcional)
      estado,                // ✅ NUEVO
    } = req.body;

    console.log('📥 Datos recibidos para registro de movimiento:', {
      user_id: req.user.id,
      region,
      distancia_recorrida,
      velocidad_maxima,
      tipo_movimiento,
      transporte_utilizado,
    });

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
        mensaje: 'Datos de movimiento incompletos.' 
      });
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

    // Crear movimiento con todos los campos
    const movement = new Movement({
      user_id: req.user.id,
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
      distancia_recorrida,
      velocidad_promedio,
      velocidad_maxima,
      tiempo_total,
      fecha: new Date(fecha),
      fecha_fin: end_location?.timestamp ? new Date(end_location.timestamp) : new Date(),
      region,
      
      // ✅ CAMPOS REQUERIDOS POR EL MODELO
      tipo_movimiento: tipo_movimiento || 'recorrido_seguridad',
      transporte_utilizado: transporte_utilizado || 'carro',
      estado: estado || 'completado',
      
      // ✅ CAMPOS OPCIONALES
      ruta_seguida: ruta_seguida || [],
      observaciones: observaciones || '',
    });

    await movement.save();

    // ✅ Poblar usuario para devolver nombre completo
    await movement.populate('user_id', 'nombre_completo correo_electronico region');

    console.log(`✅ Movimiento registrado exitosamente:`, {
      id: movement._id,
      usuario: movement.user_id.nombre_completo,
      distancia: distancia_recorrida,
      region
    });

    res.status(201).json({
      success: true,
      mensaje: 'Movimiento registrado correctamente.',
      movement
    });

  } catch (error) {
    console.error('❌ Error al registrar movimiento:', error);
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

    console.log(`📅 Obteniendo movimientos del día: ${fechaStr} para usuario: ${req.user.id}`);

    const movimientos = await Movement.aggregate([
      { 
        $match: { 
          user_id: req.user.id, 
          fecha: { $gte: fecha, $lt: nextDay } 
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

    res.json(resultado);
  } catch (error) {
    console.error('❌ Error al obtener movimientos por fecha:', error);
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Consultar historial mensual del usuario
exports.getMovementsByMonth = async (req, res) => {
  try {
    const month = parseInt(req.params.month) - 1; // Mes base 0
    const year = parseInt(req.params.year);
    const firstDay = new Date(year, month, 1);
    const nextMonth = new Date(year, month + 1, 1);

    console.log(`📆 Obteniendo movimientos del mes ${month + 1}/${year} para usuario: ${req.user.id}`);

    const movimientos = await Movement.aggregate([
      { 
        $match: {
          user_id: req.user.id,
          fecha: { $gte: firstDay, $lt: nextMonth }
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

    res.json(resultado);
  } catch (error) {
    console.error('❌ Error al obtener movimientos por mes:', error);
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};
