require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');

const connectDB = require('./src/config/mongo');
const iniciarTareasProgramadas = require('./src/cron/exportarReporteMensual');
const manejoErrores = require('./src/middlewares/manejoErrores');

// Imports de rutas  
const authRoutes = require('./src/routes/auth');
const dashboardRoutes = require('./src/routes/dashboard'); 
const userRoutes = require('./src/routes/users');
const movementRoutes = require('./src/routes/movements');
const adminRoutes = require('./src/routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP por ventana de tiempo
  message: {
    success: false,
    message: 'Demasiadas peticiones, intenta más tarde'
  }
});


app.use(limiter); // Aplicar rate limiting
app.use(cors({ 
  origin: process.env.NODE_ENV === 'production' ? 'https://back-end-fjnh.onrender.com' : '*',
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));


app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - ${req.ip} - ${new Date().toISOString()}`);
  next();
});

// Rutas API
app.use('/api/v1/auth', authRoutes); 
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/movements', movementRoutes);

// Más rutas de utilidad
app.get('/api/v1/system/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Backend funcionando correctamente',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// ✅ NUEVO: Ruta para verificar conexión DB
app.get('/api/v1/system/db-status', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const dbState = mongoose.connection.readyState;
    
    const states = {
      0: 'disconnected',
      1: 'connected', 
      2: 'connecting',
      3: 'disconnecting'
    };

    res.json({
      status: 'OK',
      database: {
        state: states[dbState],
        name: mongoose.connection.name
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Error al verificar estado de la base de datos'
    });
  }
});

// ✅ Función principal de inicio del servidor
const startServer = async () => {
  try {
    // ✅ Conectar a la base de datos
    await connectDB();

    // ✅ Inicializar usuario admin
    await initAdmin();

    async function initAdmin() {
  try {
    const User = require('./src/models/User');
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'supervitecingenieriasas@gmail.com';
    const adminPass = process.env.DEFAULT_ADMIN_PASSWORD || '5up3r_v1t3c_4dm1n_2024!';

    let admin = await User.findOne({ correo_electronico: adminEmail });

    if (!admin) {
      console.log('🔐 Creando usuario administrador...');
      
      // ✅ NO HASHEAR MANUALMENTE - DEJAR QUE EL MODELO LO HAGA
      admin = new User({
        nombre_completo: 'Administrador SupervitecApp',
        correo_electronico: adminEmail,
        contrasena: adminPass, // ← SIN HASH MANUAL - EL MODELO LO HARÁ
        region: 'Caldas',
        transporte: 'carro',
        rol: 'admin',
        activo: true,
        fechaCreacion: new Date()
      });
      
      await admin.save(); // ← Solo aquí se hashea una vez
      console.log(`✅ Admin creado: ${admin.correo_electronico}`);
      console.log(`🔑 Contraseña: ${adminPass}`);
      
    } else {
      console.log(`ℹ️ Admin existente: ${admin.correo_electronico}`);
      
      // ✅ SOLO ACTUALIZAR SI NO TIENE HASH VÁLIDO O SI ESTÁ EN TEXTO PLANO
      if (!admin.contrasena || admin.contrasena.length < 50) {
        console.log('🔄 Actualizando contraseña admin...');
        
        // ✅ NO HASHEAR MANUALMENTE - DEJAR QUE EL MODELO LO HAGA
        admin.contrasena = adminPass; // ← SIN HASH MANUAL
        await admin.save(); // ← Solo aquí se hashea
        console.log('✅ Contraseña admin actualizada');
      }
      
      if (!admin.activo) {
        admin.activo = true;
        await admin.save();
        console.log('✅ Admin reactivado');
      }
    }

    return admin;
  } catch (error) {
    console.error('❌ Error inicializando admin:', error);
    throw error;
  }
}


    // ✅ Iniciar tareas programadas
    iniciarTareasProgramadas();

    // ✅ Middleware de manejo de errores (debe ir al final)
    app.use(manejoErrores);
    
    // Manejo de rutas no encontradas
    app.use('*catchcall', (req, res) => {
      res.status(404).json({
        success: false,
        message: `Ruta ${req.originalUrl} no encontrada`,
        availableEndpoints: [
          'GET /api/v1/system/health',
          'POST /api/v1/auth/login',
          'GET /api/dashboard/stats',
          'GET /api/users',
          'GET /api/v1/users/:id',
          'GET /api/v1/users/:id/toggle-status',
          'POST /api/v1/movements',
          'GET /api/v1/movements',
          'GET /api/v1/movements/daily/:date',
          'GET /api/v1/movements/monthly/:month/:year',
          'PATCH /api/v1/movements/:id',
          'DELETE /api/v1/movements/:id'
        ]
      });
    });

    
    // ✅ Iniciar servidor
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('🚀 ================================');
      console.log(`✅ Backend SupervitecApp corriendo`);
      console.log(`🌐 Puerto: ${PORT}`);
      console.log(`📊 Dashboard: http://192.168.1.6:${PORT}/api/dashboard/stats`);
      console.log(`🏥 Health: http://192.168.1.6:${PORT}/api/v1/system/health`);
      console.log(`📂 DB Status: http://192.168.1.6:${PORT}/api/v1/system/db-status`);
      console.log('🚀 ================================');
    });

    // ✅ Manejo graceful de cierre del servidor
    process.on('SIGTERM', () => {
      console.log('📴 SIGTERM recibido. Cerrando servidor...');
      server.close(() => {
        console.log('✅ Proceso terminado');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error);
    process.exit(1);
  }
};

// ✅ Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Promesa no manejada:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Excepción no capturada:', err);
  process.exit(1);
});

// ✅ Iniciar el servidor
startServer();
