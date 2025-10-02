const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth'); 
const Movement = require('../models/Movement');
const User = require('../models/User');

// GET /api/dashboard/stats - Estadísticas del dashboard admin
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    console.log('📊 Dashboard stats requested by usuario:', req.usuario?.id);

    // ✅ MEJORA: Obtener datos reales de la base de datos
    const [
      totalMovimientos,
      movimientosHoy,
      totalUsuarios,
      usuariosActivos
    ] = await Promise.all([
      // Total de movimientos
      Movement.countDocuments(),
      
      // Movimientos de hoy
      Movement.countDocuments({
        createdAt: { 
          $gte: new Date().setHours(0,0,0,0),
          $lt: new Date().setHours(23,59,59,999)
        }
      }),
      
      // Total de usuarios
      User.countDocuments(),
      
      // Usuarios activos
      User.countDocuments({ activo: true })
    ]);

    // ✅ MEJORA: Movimientos de la semana
    const inicioSemana = new Date();
    inicioSemana.setDate(inicioSemana.getDate() - 7);
    const movimientosSemana = await Movement.countDocuments({
      createdAt: { $gte: inicioSemana }
    });

    const stats = {
      // ✅ Datos reales de la base de datos
      totalMovimientos: totalMovimientos || 0,
      movimientosHoy: movimientosHoy || 0,
      movimientosSemana: movimientosSemana || 0,
      totalUsuarios: totalUsuarios || 0,
      usuariosActivos: usuariosActivos || 0,
      
      // ✅ Datos calculados o mock (hasta que tengas la lógica real)
      alertasActivas: 3,
      reportesPendientes: 2,
      cumplimientoSST: 85,
      regionMasActiva: 'Manizales',
      ultimaActualizacion: new Date().toISOString()
    };

    console.log('✅ Dashboard stats generated:', stats);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error getting dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/dashboard/recent-activity - Actividad reciente
router.get('/recent-activity', authMiddleware, async (req, res) => {
  try {
    console.log('📋 Recent activity requested by usuario:', req.usuario?.id);

    // ✅ MEJORA: Obtener actividad real de la base de datos
    const recentMovements = await Movement.find()
      .populate('usuarioId', 'nombre_completo')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // ✅ Mapear a formato esperado por frontend
    const activities = recentMovements.map((movement, index) => ({
      id: movement._id || index + 1,
      usuarioId: movement.usuarioId?._id || 'unknown',
      usuarioName: movement.usuarioId?.nombre_completo || 'Usuario Desconocido',
      type: movement.tipo || 'movement_completed',
      description: movement.descripcion || 'Actividad de movimiento',
      timestamp: movement.createdAt || new Date().toISOString()
    }));

    // ✅ Fallback a datos mock si no hay actividad real
    if (activities.length === 0) {
      const mockActivities = [
        {
          id: 1,
          usuarioId: 'usuario123',
          usuarioName: 'Juan Celis',
          type: 'movement_completed',
          description: 'Completó recorrido de seguridad',
          timestamp: new Date(Date.now() - 30 * 60000).toISOString()
        },
        {
          id: 2,
          usuarioId: 'usuario456',
          usuarioName: 'María García',
          type: 'movement_started',
          description: 'Inició nuevo recorrido',
          timestamp: new Date(Date.now() - 75 * 60000).toISOString()
        },
        {
          id: 3,
          usuarioId: 'usuario789',
          usuarioName: 'Carlos López',
          type: 'incident_reported',
          description: 'Reportó incidente de seguridad',
          timestamp: new Date(Date.now() - 135 * 60000).toISOString()
        }
      ];
      
      return res.json({
        success: true,
        data: mockActivities
      });
    }

    res.json({
      success: true,
      data: activities
    });

  } catch (error) {
    console.error('❌ Error getting recent activity:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// ✅ NUEVO: Endpoint para métricas adicionales
router.get('/metrics', authMiddleware, async (req, res) => {
  try {
    // Métricas por región
    const metricasPorRegion = await User.aggregate([
      {
        $group: {
          _id: '$region',
          count: { $sum: 1 },
          activos: { 
            $sum: { $cond: [{ $eq: ['$activo', true] }, 1, 0] } 
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        regionesStats: metricasPorRegion,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error getting metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;
