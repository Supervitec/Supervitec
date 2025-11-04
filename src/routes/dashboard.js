const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth'); 
const Movement = require('../models/Movement');
const User = require('../models/User');

// ========================================
// GET /api/dashboard/stats
// Estadísticas generales del dashboard
// ========================================
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    console.log('📊 Dashboard stats requested by usuario:', req.usuario?.id);

    //  Obtener fecha actual y rangos
    const hoy = new Date();
    const inicioHoy = new Date(hoy.setHours(0, 0, 0, 0));
    const finHoy = new Date(hoy.setHours(23, 59, 59, 999));
    const inicioSemana = new Date();
    inicioSemana.setDate(inicioSemana.getDate() - 7);

    //  Consultas paralelas para mejor rendimiento
    const [
      totalMovimientos,
      movimientosHoy,
      movimientosSemana,
      totalUsuarios,
      usuariosActivos,
      alertasActivas,
      regionMasActiva
    ] = await Promise.all([
      // Total de movimientos
      Movement.countDocuments({ activo: true }),
      
      // Movimientos de hoy
      Movement.countDocuments({
        activo: true,
        fecha: { $gte: inicioHoy, $lt: finHoy }
      }),
      
      // Movimientos de la semana
      Movement.countDocuments({
        activo: true,
        fecha: { $gte: inicioSemana }
      }),
      
      // Total de usuarios
      User.countDocuments(),
      
      // Usuarios activos
      User.countDocuments({ activo: true }),
      
      // Alertas activas (incidentes de gravedad alta/crítica últimos 7 días)
      Movement.countDocuments({
        activo: true,
        fecha: { $gte: inicioSemana },
        'incidentes.gravedad': { $in: ['alta', 'critica'] }
      }),
      
      // Región más activa
      Movement.aggregate([
        { $match: { activo: true } },
        { $group: { _id: '$region', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ])
    ]);

    //  Calcular métricas adicionales
    const promedioMovimientosPorDia = movimientosSemana > 0 
      ? (movimientosSemana / 7).toFixed(1) 
      : 0;

    const stats = {
      // Estadísticas principales
      totalMovimientos,
      movimientosHoy,
      movimientosSemana,
      promedioMovimientosPorDia: parseFloat(promedioMovimientosPorDia),
      
      // Usuarios
      totalUsuarios,
      usuariosActivos,
      usuariosInactivos: totalUsuarios - usuariosActivos,
      
      // Alertas y seguridad
      alertasActivas,
      reportesPendientes: 0, // TODO: Implementar cuando tengas modelo de reportes
      
      // Región más activa
      regionMasActiva: regionMasActiva[0]?._id || 'Sin datos',
      movimientosRegionMasActiva: regionMasActiva[0]?.count || 0,
      
      // Cumplimiento SST (porcentaje de movimientos sin incidentes)
      cumplimientoSST: totalMovimientos > 0 
        ? Math.round(((totalMovimientos - alertasActivas) / totalMovimientos) * 100)
        : 100,
      
      // Metadata
      ultimaActualizacion: new Date().toISOString()
    };

    console.log(' Dashboard stats generated:', stats);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error(' Error getting dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ========================================
// GET /api/dashboard/recent-activity
// Actividad reciente del sistema
// ========================================
router.get('/recent-activity', authMiddleware, async (req, res) => {
  try {
    console.log('📋 Recent activity requested by usuario:', req.usuario?.id);
    
    const limit = parseInt(req.query.limit) || 10;

    //  CORRECCIÓN: usar 'user_id' en lugar de 'usuarioId'
    const recentMovements = await Movement.find({ activo: true })
      .populate('user_id', 'nombre_completo rol region')
      .sort({ fecha: -1 })
      .limit(limit)
      .lean();

    //  Mapear a formato esperado por frontend
    const activities = recentMovements.map((movement) => {
      let type = 'movement_completed';
      let description = '';

      // Determinar tipo de actividad
      if (movement.estado === 'completado') {
        type = 'movement_completed';
        description = `Completó ${movement.tipo_movimiento || 'recorrido'}`;
      } else if (movement.estado === 'iniciado' || movement.estado === 'en_progreso') {
        type = 'movement_started';
        description = `Inició ${movement.tipo_movimiento || 'recorrido'}`;
      } else if (movement.incidentes && movement.incidentes.length > 0) {
        type = 'incident_reported';
        description = `Reportó ${movement.incidentes.length} incidente(s)`;
      }

      return {
        id: movement._id,
        userId: movement.user_id?._id || 'unknown',
        userName: movement.user_id?.nombre_completo || 'Usuario Desconocido',
        userRole: movement.user_id?.rol || 'N/A',
        type,
        description,
        region: movement.region || 'N/A',
        distance: movement.distancia_recorrida || 0,
        timestamp: movement.fecha || movement.created_at
      };
    });

    res.json({
      success: true,
      data: activities,
      total: activities.length
    });

  } catch (error) {
    console.error(' Error getting recent activity:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// ========================================
// GET /api/dashboard/metrics
// Métricas avanzadas (por región, rol, transporte)
// ========================================
router.get('/metrics', authMiddleware, async (req, res) => {
  try {
    console.log('📈 Metrics requested by usuario:', req.usuario?.id);

    // Métricas por región
    const metricasPorRegion = await User.aggregate([
      {
        $group: {
          _id: '$region',
          totalUsuarios: { $sum: 1 },
          activos: { 
            $sum: { $cond: [{ $eq: ['$activo', true] }, 1, 0] } 
          }
        }
      },
      { $sort: { totalUsuarios: -1 } }
    ]);

    // Movimientos por región
    const movimientosPorRegion = await Movement.aggregate([
      { $match: { activo: true } },
      {
        $group: {
          _id: '$region',
          totalMovimientos: { $sum: 1 },
          distanciaTotal: { $sum: '$distancia_recorrida' },
          velocidadPromedio: { $avg: '$velocidad_promedio' }
        }
      },
      { $sort: { totalMovimientos: -1 } }
    ]);

    // Métricas por tipo de transporte
    const movimientosPorTransporte = await Movement.aggregate([
      { $match: { activo: true } },
      {
        $group: {
          _id: '$transporte_utilizado',
          count: { $sum: 1 },
          distanciaPromedio: { $avg: '$distancia_recorrida' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Incidentes por gravedad
    const incidentesPorGravedad = await Movement.aggregate([
      { $match: { activo: true, incidentes: { $exists: true, $ne: [] } } },
      { $unwind: '$incidentes' },
      {
        $group: {
          _id: '$incidentes.gravedad',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        regionesStats: metricasPorRegion,
        movimientosPorRegion,
        transporteStats: movimientosPorTransporte,
        incidentesStats: incidentesPorGravedad,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(' Error getting metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// ========================================
// GET /api/dashboard/charts
// Datos para gráficas (últimos 7 días)
// ========================================
router.get('/charts', authMiddleware, async (req, res) => {
  try {
    const diasAtras = parseInt(req.query.dias) || 7;
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - diasAtras);

    // Movimientos por día
    const movimientosPorDia = await Movement.aggregate([
      { 
        $match: { 
          activo: true, 
          fecha: { $gte: fechaInicio } 
        } 
      },
      {
        $group: {
          _id: { 
            $dateToString: { format: '%Y-%m-%d', date: '$fecha' } 
          },
          count: { $sum: 1 },
          distanciaTotal: { $sum: '$distancia_recorrida' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        movimientosPorDia,
        periodo: `${diasAtras} días`
      }
    });

  } catch (error) {
    console.error(' Error getting charts data:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;
