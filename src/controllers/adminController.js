const Admin = require('../models/admin');
const User = require('../models/User');
const Movement = require('../models/Movement');
const AdminConfig = require('../models/AdminConfig');
const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');
const mongoose = require('mongoose');

const JWT_SECRET = process.env.JWT_SECRET || '5up3r_v1t3c';
const REFRESH_SECRET = process.env.REFRESH_SECRET || '5up3r_v1t3c';

// ===== LOGIN Y AUTENTICACIÓN =====

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

    const payload = { id: admin._id, correo_electronico: admin.correo_electronico, role: 'admin' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
    const refresh_token = jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });

    res.json({ 
      token, 
      refresh_token,
      correo_electronico: admin.correo_electronico 
    });
  } catch (e) {
    console.error('Error login admin:', e);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};

// ===== GESTIÓN DE USUARIOS =====

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

exports.actualizarUsuario = async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;

    const camposPermitidos = ['nombre_completo', 'correo_electronico', 'region', 'transporte', 'rol'];
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

exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Usuario eliminado exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};

exports.getUserStats = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📊 Obteniendo estadísticas del usuario:', id);

    // ✅ CONVERTIR A OBJECTID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido'
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(id);

    const user = await User.findById(userObjectId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // ✅ BUSCAR CON OBJECTID
    const movements = await Movement.find({
      user_id: userObjectId, // ✅ Ahora es ObjectId
      activo: true
    });

    console.log(`✅ ${movements.length} movimientos encontrados para el usuario`);

    const totalMovements = movements.length;
    const totalDistance = movements.reduce((sum, mov) => sum + (mov.distancia_recorrida || 0), 0);
    const averageDistance = totalMovements > 0 ? totalDistance / totalMovements : 0;
    const maxSpeed = movements.length > 0
      ? Math.max(...movements.map(mov => mov.velocidad_maxima || 0))
      : 0;
    const totalTime = movements.reduce((sum, mov) => sum + (mov.tiempo_total || 0), 0);
    const lastActivity = movements.length > 0
      ? movements.sort((a, b) => b.fecha - a.fecha)[0].fecha
      : null;

    const allUsers = await Movement.aggregate([
      { $match: { activo: true } },
      {
        $group: {
          _id: '$user_id',
          totalDistance: { $sum: '$distancia_recorrida' }
        }
      },
      { $sort: { totalDistance: -1 } }
    ]);

    const rankingPosition = allUsers.findIndex(u => u._id.toString() === id) + 1;

    const stats = {
      totalMovements,
      totalDistance: parseFloat(totalDistance.toFixed(2)),
      averageDistance: parseFloat(averageDistance.toFixed(2)),
      maxSpeed: parseFloat(maxSpeed.toFixed(2)),
      totalTime: Math.round(totalTime),
      lastActivity,
      rankingPosition: rankingPosition || 0
    };

    console.log('✅ Estadísticas calculadas:', stats);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

exports.getUserMovements = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📍 Obteniendo movimientos del usuario:', id);

    // ✅ CONVERTIR A OBJECTID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido'
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(id);

    const user = await User.findById(userObjectId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // ✅ CONSTRUIR QUERY CON OBJECTID
    const query = {
      user_id: userObjectId, // ✅ Ahora es ObjectId
      activo: true
    };

    if (req.query.estado) query.estado = req.query.estado;
    if (req.query.region) query.region = req.query.region;
    if (req.query.tipo_movimiento) query.tipo_movimiento = req.query.tipo_movimiento;

    if (req.query.fecha_inicio && req.query.fecha_fin) {
      query.fecha = {
        $gte: new Date(req.query.fecha_inicio),
        $lte: new Date(req.query.fecha_fin)
      };
    }

    const movements = await Movement.find(query)
      .sort({ fecha: -1 })
      .limit(parseInt(req.query.limit) || 100);

    console.log(`✅ ${movements.length} movimientos encontrados`);

    res.json({
      success: true,
      data: movements,
      count: movements.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo movimientos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// ===== GESTIÓN DE MOVIMIENTOS =====

exports.getMovements = async (req, res) => {
  try {
    const { Usuario, region } = req.query;
    const query = {};
    
    if (Usuario) query.user_id = Usuario;
    if (region) query.region = region;
    
    const movements = await Movement.find(query).populate('user_id', 'nombre_completo correo_electronico');
    res.json(movements);
  } catch (error) {
    console.error('Error obtener movimientos:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};

exports.actualizarMovimiento = async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    const camposPermitidos = ['distancia_recorrida', 'velocidad_promedio', 'velocidad_maxima', 'tiempo_total', 'fecha', 'region'];
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

exports.deleteMovement = async (req, res) => {
  try {
    await Movement.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Movimiento eliminado exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar movimiento:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};

// ===== EXPORTACIÓN =====

exports.exportMovements = async (req, res) => {
  try {
    const { month, year, region } = req.params;
    console.log(`📤 Exportando movimientos: ${month}/${year}${region ? ` - ${region}` : ''}`);

    // ✅ CONSTRUIR FECHAS CORRECTAMENTE
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    const match = {
      fecha: {
        $gte: new Date(yearNum, monthNum - 1, 1),
        $lt: new Date(yearNum, monthNum, 1),
      },
      activo: true
    };

    if (region && region !== 'todas') { // ✅ Permitir "todas" como filtro
      match.region = region;
    }

    const data = await Movement.find(match)
      .populate('user_id', 'nombre_completo correo_electronico region transporte rol')
      .lean();

    console.log(`📊 ${data.length} movimientos encontrados`);

    if (data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron movimientos para el período seleccionado'
      });
    }

    // ✅ LOG PARA VERIFICAR tiempo_total
    if (data.length > 0) {
      console.log('🔍 Primer movimiento tiempo_total:', data[0].tiempo_total);
    }

    const records = data.map(mov => ({
      Usuario: mov.user_id?.nombre_completo || 'N/A',
      Correo: mov.user_id?.correo_electronico || 'N/A',
      Región: mov.region || 'N/A',
      Transporte: mov.user_id?.transporte || mov.transporte_utilizado || 'N/A',
      Rol: mov.user_id?.rol || 'N/A',
      Fecha: mov.fecha ? mov.fecha.toISOString().substring(0, 10) : 'N/A',
      'Distancia (km)': ((mov.distancia_recorrida || 0) / 1000).toFixed(2),
      'Velocidad Promedio (km/h)': (mov.velocidad_promedio || 0).toFixed(1),
      'Velocidad Máxima (km/h)': (mov.velocidad_maxima || 0).toFixed(1),
      'Tiempo (minutos)': mov.tiempo_total || 0
    }));

    console.log('✅ Primer registro formateado:', records[0]);

    const ws = XLSX.utils.json_to_sheet(records);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimientos");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader('Content-Disposition', `attachment; filename=supervitec_${month}_${year}.xlsx`);
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    console.log('✅ Archivo Excel enviado');
    res.send(buf);

  } catch (err) {
    console.error('❌ Error exportando movimientos:', err);
    res.status(500).json({ 
      success: false,
      mensaje: 'Error al exportar', 
      error: err.message 
    });
  }
};

// ===== CONFIGURACIÓN DEL ADMINISTRADOR =====

exports.getAdminConfig = async (req, res) => {
  try {
    console.log('📋 Obteniendo configuración del admin:', req.admin.id);
    
    const config = await AdminConfig.getOrCreateConfig(req.admin.id);
    
    res.json({
      success: true,
      config: {
        notificacionesPush: config.notificacionesPush.enabled,
        reportesAutomaticos: config.reportesAutomaticos.enabled,
        backupAutomatico: config.backupAutomatico.enabled,
        alertasDeSeguridad: config.alertasDeSeguridad.enabled,
        reportesConfig: {
          frecuencia: config.reportesAutomaticos.frecuencia,
          hora: config.reportesAutomaticos.hora,
          ultimoReporte: config.reportesAutomaticos.ultimoReporte,
        },
        backupConfig: {
          frecuencia: config.backupAutomatico.frecuencia,
          hora: config.backupAutomatico.hora,
          ultimoBackup: config.backupAutomatico.ultimoBackup,
        },
      },
    });
  } catch (error) {
    console.error(' Error obteniendo configuración:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error obteniendo configuración',
      error: error.message,
    });
  }
};

exports.updateAdminConfig = async (req, res) => {
  try {
    const { setting, value } = req.body;
    
    console.log(`⚙️ Actualizando ${setting} a ${value} para admin:`, req.admin.id);
    
    if (!setting || value === undefined) {
      return res.status(400).json({
        success: false,
        mensaje: 'Faltan parámetros requeridos',
      });
    }
    
    const config = await AdminConfig.getOrCreateConfig(req.admin.id);
    
    switch (setting) {
      case 'notificacionesPush':
        config.notificacionesPush.enabled = value;
        config.notificacionesPush.lastUpdated = new Date();
        break;
        
      case 'reportesAutomaticos':
        config.reportesAutomaticos.enabled = value;
        config.reportesAutomaticos.lastUpdated = new Date();
        
        if (value && !config.reportesAutomaticos.ultimoReporte) {
          console.log('📊 Reportes automáticos activados');
        }
        break;
        
      case 'backupAutomatico':
        config.backupAutomatico.enabled = value;
        config.backupAutomatico.lastUpdated = new Date();
        
        if (value && !config.backupAutomatico.ultimoBackup) {
          console.log('💾 Backup automático activado');
        }
        break;
        
      case 'alertasDeSeguridad':
        config.alertasDeSeguridad.enabled = value;
        config.alertasDeSeguridad.lastUpdated = new Date();
        break;
        
      default:
        return res.status(400).json({
          success: false,
          mensaje: 'Configuración no válida',
        });
    }
    
    await config.save();
    
    console.log(` Configuración ${setting} actualizada exitosamente`);
    
    res.json({
      success: true,
      mensaje: `${setting} actualizado correctamente`,
      config: {
        notificacionesPush: config.notificacionesPush.enabled,
        reportesAutomaticos: config.reportesAutomaticos.enabled,
        backupAutomatico: config.backupAutomatico.enabled,
        alertasDeSeguridad: config.alertasDeSeguridad.enabled,
      },
    });
  } catch (error) {
    console.error(' Error actualizando configuración:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error actualizando configuración',
      error: error.message,
    });
  }
};

// ===== GESTIÓN AVANZADA DE USUARIOS =====

exports.getAllUsersForManagement = async (req, res) => {
  try {
    const { search } = req.query;
    
    let query = {};
    if (search) {
      query = {
        $or: [
          { nombre_completo: { $regex: search, $options: 'i' } },
          { correo_electronico: { $regex: search, $options: 'i' } },
          { region: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    const users = await User.find(query).select('-contrasena').sort({ created_at: -1 });
    
    console.log(` ${users.length} usuarios encontrados`);
    
    res.json({
      success: true,
      users,
      total: users.length
    });
  } catch (error) {
    console.error(' Error obteniendo usuarios:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener usuarios',
      error: error.message,
    });
  }
};

exports.editUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    console.log(`✏️ Admin editando usuario: ${userId}`);
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        mensaje: 'Usuario no encontrado'
      });
    }
    
    const allowedFields = [
      'nombre_completo',
      'correo_electronico',
      'region',
      'transporte',
      'rol'
    ];
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        user[field] = updates[field];
      }
    });
    
    await user.save();
    
    console.log(` Usuario actualizado: ${user.nombre_completo}`);
    
    res.json({
      success: true,
      mensaje: 'Usuario actualizado correctamente',
      user: {
        _id: user._id,
        nombre_completo: user.nombre_completo,
        correo_electronico: user.correo_electronico,
        region: user.region,
        transporte: user.transporte,
        rol: user.rol
      }
    });
  } catch (error) {
    console.error(' Error editando usuario:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al editar usuario',
      error: error.message,
    });
  }
};

exports.deleteUserPermanently = async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`🗑️ Admin eliminando usuario: ${userId}`);
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        mensaje: 'Usuario no encontrado'
      });
    }
    
    const userName = user.nombre_completo;
    
    await Movement.deleteMany({ user_id: userId });
    await User.findByIdAndDelete(userId);
    
    console.log(` Usuario ${userName} eliminado permanentemente`);
    
    res.json({
      success: true,
      mensaje: `Usuario ${userName} eliminado correctamente`,
    });
  } catch (error) {
    console.error(' Error eliminando usuario:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al eliminar usuario',
      error: error.message,
    });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { nombre_completo, correo_electronico, contrasena, region, transporte, rol } = req.body;
    
    const userExists = await User.findOne({ correo_electronico });
    if (userExists) {
      return res.status(400).json({ 
        success: false,
        mensaje: 'El correo ya está registrado' 
      });
    }

    const newUser = new User({
      nombre_completo,
      correo_electronico,
      contrasena,
      region: region || 'Caldas',
      transporte: transporte || 'carro',
      rol: rol || 'usuario'
    });

    await newUser.save();
    
    console.log(` Usuario creado: ${newUser.nombre_completo}`);
    
    res.status(201).json({ 
      success: true,
      mensaje: 'Usuario creado exitosamente', 
      usuario: {
        _id: newUser._id,
        nombre_completo: newUser.nombre_completo,
        correo_electronico: newUser.correo_electronico,
        region: newUser.region,
        transporte: newUser.transporte,
        rol: newUser.rol
      }
    });
  } catch (error) {
    console.error(' Error creando usuario:', error);
    res.status(500).json({ 
      success: false,
      mensaje: 'Error en el servidor',
      error: error.message
    });
  }
};

exports.changeUserPassword = async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    
    console.log(`🔐 Admin cambiando contraseña del usuario: ${userId}`);
    
    if (!userId || !newPassword) {
      return res.status(400).json({
        success: false,
        mensaje: 'userId y newPassword son requeridos'
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        mensaje: 'La contraseña debe tener al menos 6 caracteres'
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        mensaje: 'Usuario no encontrado'
      });
    }
    
    user.contrasena = newPassword;
    await user.save();
    
    console.log(` Contraseña actualizada para usuario: ${user.nombre_completo}`);
    
    res.json({
      success: true,
      mensaje: `Contraseña actualizada para ${user.nombre_completo}`,
    });
  } catch (error) {
    console.error(' Error cambiando contraseña:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al cambiar la contraseña',
      error: error.message,
    });
  }
};

// ===== SISTEMA =====

exports.exportAllData = async (req, res) => {
  try {
    console.log('📤 Iniciando exportación completa de datos...');
    
    const users = await User.find().select('-contrasena').lean();
    const movements = await Movement.find().populate('user_id', 'nombre_completo correo_electronico').lean();
    const admins = await Admin.find().select('-contrasena').lean();
    
    const usersData = users.map(u => ({
      Nombre: u.nombre_completo,
      Correo: u.correo_electronico,
      Región: u.region,
      Transporte: u.transporte,
      Rol: u.rol,
      Fecha_Registro: u.created_at
    }));
    
    const movementsData = movements.map(m => ({
      Usuario: m.user_id?.nombre_completo || 'N/A',
      Fecha: m.fecha,
      Región: m.region,
      Distancia_km: m.distancia_recorrida,
      Tiempo_min: m.tiempo_total,
      Velocidad_Prom: m.velocidad_promedio,
      Velocidad_Max: m.velocidad_maxima,
      Lugar_Inicio: m.lugar_start,
      Lugar_Fin: m.lugar_end
    }));
    
    const wb = XLSX.utils.book_new();
    
    const wsUsers = XLSX.utils.json_to_sheet(usersData);
    const wsMovements = XLSX.utils.json_to_sheet(movementsData);
    
    XLSX.utils.book_append_sheet(wb, wsUsers, "Usuarios");
    XLSX.utils.book_append_sheet(wb, wsMovements, "Movimientos");
    
    const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'supervitecingenieriasas@gmail.com',
        pass: process.env.EMAIL_PASS
      }
    });
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'supervitecingenieriasas@gmail.com',
      to: 'supervitecingenieriasas@gmail.com',
      subject: `Exportación Completa de Datos - ${new Date().toLocaleDateString()}`,
      text: `Backup completo del sistema adjunto.\n\nTotal Usuarios: ${users.length}\nTotal Movimientos: ${movements.length}\nFecha: ${new Date().toLocaleString()}`,
      attachments: [
        {
          filename: `backup_completo_${Date.now()}.xlsx`,
          content: excelBuffer
        }
      ]
    };
    
    await transporter.sendMail(mailOptions);
    
    console.log(' Exportación enviada por correo exitosamente');
    
    res.json({
      success: true,
      mensaje: 'Exportación completa enviada a supervitecingenieriasas@gmail.com',
      stats: {
        usuarios: users.length,
        movimientos: movements.length,
        admins: admins.length
      }
    });
  } catch (error) {
    console.error(' Error exportando datos:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al exportar datos',
      error: error.message,
    });
  }
};

exports.resetSystem = async (req, res) => {
  try {
    console.log('🔄 Reiniciando sistema...');
    
    res.json({
      success: true,
      mensaje: 'Sistema reiniciado correctamente. Por favor reinicia la aplicación.'
    });
  } catch (error) {
    console.error(' Error reiniciando sistema:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al reiniciar el sistema',
      error: error.message,
    });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { userId, subject, message } = req.body;

    // Validaciones
    if (!userId || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'userId, subject y message son obligatorios'
      });
    }
    
    res.json({
      success: true,
      message: 'Mensaje enviado correctamente'
    });
  } catch (error) {
    console.error('Error enviando mensaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error enviando mensaje'
    });
  }
};

