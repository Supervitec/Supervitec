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
    } = req.body;

    // Validar campos obligatorios
    if (
      !start_location ||
      !end_location ||
      !distancia_recorrida ||
      !velocidad_promedio ||
      !velocidad_maxima ||
      !tiempo_total ||
      !fecha ||
      !region
    ) {
      return res.status(400).json({ mensaje: 'Datos de movimiento incompletos.' });
    }

    const movement = new Movement({
      user_id: req.user.id,
      start_location,
      end_location,
      distancia_recorrida,
      velocidad_promedio,
      velocidad_maxima,
      tiempo_total,
      fecha,
      region,
    });

    await movement.save();

    // Retorna el movimiento completo para integración con frontend (e.g., reverse geocode en mobile)
    res.status(201).json({ 
      mensaje: 'Movimiento registrado correctamente.',
      movement  // Devuelve todo el objeto (incluye ID, locations para calcular "lugar")
    });
  } catch (error) {
    console.error('Error al registrar movimiento:', error);
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Consultar movimientos diarios del usuario
exports.getMovementsByDate = async (req, res) => {
  try {
    const fechaStr = req.params.date;
    const fecha = new Date(fechaStr);
    const nextDay = new Date(fechaStr);
    nextDay.setDate(nextDay.getDate() + 1);

    const movimientos = await Movement.aggregate([
      { $match: { user_id: req.user.id, fecha: { $gte: fecha, $lt: nextDay } } },
      { $group: {
          _id: null,
          totalRecorridos: { $sum: 1 },  // Cuenta de trips
          totalDistancia: { $sum: "$distancia_recorrida" },
          avgVelPromedio: { $avg: "$velocidad_promedio" },
          maxVelMaxima: { $max: "$velocidad_maxima" },
          movimientos: { $push: "$$ROOT" }  // Incluye todos los docs
        }
      }
    ]);

    res.json(movimientos[0] || { totalRecorridos: 0, totalDistancia: 0, avgVelPromedio: 0, maxVelMaxima: 0, movimientos: [] });
  } catch (error) {
    console.error('Error al obtener movimientos por fecha:', error);
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};

// Consultar historial mensual del usuario (con resúmenes y locations para reverse geocode)
exports.getMovementsByMonth = async (req, res) => {
  try {
    const month = parseInt(req.params.month) - 1; // Mes base 0
    const year = parseInt(req.params.year);
    const firstDay = new Date(year, month, 1);
    const nextMonth = new Date(year, month + 1, 1);

    const movimientos = await Movement.aggregate([
      { $match: {
          user_id: req.user.id,
          fecha: { $gte: firstDay, $lt: nextMonth }
        }
      },
      { $group: {
          _id: null,
          totalRecorridos: { $sum: 1 },
          totalDistancia: { $sum: "$distancia_recorrida" },
          avgVelPromedio: { $avg: "$velocidad_promedio" },
          maxVelMaxima: { $max: "$velocidad_maxima" },
          locations: { $push: "$start_location" } // Devuelve ubicaciones para reverse geocode en frontend (para "lugar")
        }
      }
    ]);

    res.json(movimientos[0] || {
      totalRecorridos: 0,
      totalDistancia: 0,
      avgVelPromedio: 0,
      maxVelMaxima: 0,
      locations: []
    });
  } catch (error) {
    console.error('Error al obtener movimientos por mes:', error);
    res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
  }
};
