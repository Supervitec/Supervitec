const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); 
const authMiddleware = require('../middlewares/auth');
const User = require('../models/User'); 

// Middleware para validar ObjectId
function validateObjectId(req, res, next) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ 
      success: false, 
      message: 'ID de usuario inválido' 
    });
  }
  next();
}

// ==================== RUTAS ESPECÍFICAS PRIMERO ====================

// ✅ GET /api/v1/users/list - Obtener lista de usuarios (con filtro opcional por rol)
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const { rol } = req.query;
    console.log('📋 Obteniendo lista de usuarios', rol ? `(rol: ${rol})` : '');

    // Construir query dinámico
    let query = {};
    if (rol) {
      query.rol = rol;
    }

    // Obtener usuarios sin contraseña
    const users = await User.find(query)
      .select('_id nombre_completo correo_electronico rol activo')
      .limit(50);

    console.log(`✅ Se encontraron ${users.length} usuario(s)`);

    res.json({
      success: true,
      data: users,
      total: users.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo lista de usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo lista de usuarios',
      error: error.message
    });
  }
});

// ✅ NUEVO: GET /api/v1/users/profile - Obtener perfil del usuario autenticado
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    console.log('👤 Obteniendo perfil del usuario:', req.user.id);
    
    const user = await User.findById(req.user.id).select('-contrasena');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    console.log('✅ Perfil obtenido:', user.nombre_completo);

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('❌ Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// ✅ NUEVO: PUT /api/v1/users/profile - Actualizar perfil del usuario autenticado
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    console.log('✏️ Actualizando perfil del usuario:', req.user.id);
    
    const { nombre_completo, correo_electronico, region, transporte, password } = req.body;
    
    // Preparar datos a actualizar
    const updateData = {
      nombre_completo,
      correo_electronico,
      region,
      transporte,
      ultimo_acceso: new Date()
    };

    // Si se proporciona nueva contraseña, hashearla
    if (password) {
      const bcrypt = require('bcryptjs');
      updateData.contrasena = await bcrypt.hash(password, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, select: '-contrasena' }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    console.log('✅ Perfil actualizado:', updatedUser.nombre_completo);

    res.json({
      success: true,
      data: updatedUser,
      message: 'Perfil actualizado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error actualizando perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// ==================== RUTAS DINÁMICAS DESPUÉS ====================

// GET /api/v1/users - Obtener todos los usuarios 
router.get('/', authMiddleware, async (req, res) => {
  try {
    console.log('👥 Obteniendo todos los usuarios solicitados por:', req.user?.id);

    // Verificar que el usuario es admin
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Solo administradores pueden ver usuarios.'
      });
    }

    // Obtener todos los usuarios (excluir contraseñas)
    const users = await User.find({}, '-contrasena');

    console.log(`✅ Found ${users.length} users`);

    res.json({
      success: true,
      data: users
    });

  } catch (error) {
    console.error('❌ Error obteniendo usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// GET /api/v1/users/:id/stats - Obtener estadísticas de un usuario
router.get('/:id/stats', validateObjectId, async (req, res) => {
  try {
    const adminController = require('../controllers/adminController');
    await adminController.getUserStats(req, res);
  } catch (error) {
    console.error('❌ Error en ruta stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/v1/users/:id/movements - Obtener movimientos de un usuario
router.get('/:id/movements', validateObjectId, async (req, res) => {
  try {
    const adminController = require('../controllers/adminController');
    await adminController.getUserMovements(req, res);
  } catch (error) {
    console.error('❌ Error en ruta movements:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/v1/users/:id - Obtener usuario específico por ID
router.get('/:id', validateObjectId, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Buscando usuario con ID:', id);

    // Buscar el usuario en la base de datos (excluir contraseña)
    const user = await User.findById(id).select('-contrasena');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }

    console.log('✅ Usuario encontrado:', user.nombre_completo);

    // Actualizar último acceso
    await User.findByIdAndUpdate(id, { ultimo_acceso: new Date() });

    // Responder con los datos del usuario
    res.json({
      success: true,
      user: user
    });

  } catch (error) {
    console.error('❌ Error obteniendo usuario:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor',
      error: error.message 
    });
  }
});

// PATCH /api/v1/users/:id/toggle-status - Cambiar estado activo/inactivo
router.patch('/:id/toggle-status', validateObjectId, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔄 Cambiando estado del usuario con ID:', id);

    // Buscar el usuario actual
    const user = await User.findById(id);
    
    if (!user) {
      console.log('❌ Usuario no encontrado con ID:', id);
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }

    // Cambiar el estado (toggle)
    const newStatus = !user.activo;
    
    // Actualizar en la base de datos
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { 
        activo: newStatus,
        ultimo_acceso: new Date()
      },
      { new: true, select: '-contrasena' }
    );

    console.log(`✅ Usuario ${updatedUser.nombre_completo} ${newStatus ? 'ACTIVADO' : 'DESACTIVADO'}`);

    res.json({
      success: true,
      message: `Usuario ${newStatus ? 'activado' : 'desactivado'} correctamente`,
      user: {
        _id: updatedUser._id,
        nombre_completo: updatedUser.nombre_completo,
        correo_electronico: updatedUser.correo_electronico,
        activo: updatedUser.activo,
        ultimo_acceso: updatedUser.ultimo_acceso
      }
    });

  } catch (error) {
    console.error('❌ Error cambiando estado de usuario:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor',
      error: error.message 
    });
  }
});

// POST /api/v1/users - Crear nuevo usuario (solo admin)
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Solo administradores pueden crear usuarios.'
      });
    }

    const bcrypt = require('bcryptjs');
    const { nombre_completo, correo_electronico, contrasena, region, transporte, rol } = req.body;

    // Verificar que el usuario no existe
    const existingUser = await User.findOne({ correo_electronico });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'El usuario ya existe'
      });
    }

    // Crear nuevo usuario
    const newUser = new User({
      nombre_completo,
      correo_electronico,
      contrasena,
      region,
      transporte,
      rol: rol || 'ingeniero',
      activo: true
    });

    await newUser.save();

    console.log('✅ Nuevo usuario creado:', correo_electronico);

    // Devolver usuario sin contraseña
    const userResponse = newUser.toObject();
    delete userResponse.contrasena;

    res.status(201).json({
      success: true,
      data: userResponse,
      message: 'Usuario creado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error creando al usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// PUT /api/v1/users/:id - Actualizar usuario (solo admin)
router.put('/:id', authMiddleware, validateObjectId, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado'
      });
    }

    const { nombre_completo, correo_electronico, region, transporte, rol, activo } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { 
        nombre_completo, 
        correo_electronico, 
        region, 
        transporte, 
        rol, 
        activo,
        ultimo_acceso: new Date()
      },
      { new: true, select: '-contrasena' }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: updatedUser,
      message: 'Usuario actualizado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error actualizando al usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// DELETE /api/v1/users/:id - Eliminar usuario
router.delete('/:id', authMiddleware, validateObjectId, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Eliminando usuario con ID:', id);

    // Verificar que es admin
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Solo administradores pueden eliminar usuarios.'
      });
    }

    // Buscar el usuario antes de eliminar
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar que no se está eliminando a sí mismo
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propia cuenta'
      });
    }

    // Verificar que no es el último admin
    if (user.rol === 'admin') {
      const adminCount = await User.countDocuments({ rol: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar el único administrador del sistema'
        });
      }
    }

    // Proceder con la eliminación
    const deletedUser = await User.findByIdAndDelete(id);

    console.log('✅ Usuario eliminado:', deletedUser.nombre_completo);

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente',
      user: {
        _id: deletedUser._id,
        nombre_completo: deletedUser.nombre_completo,
        correo_electronico: deletedUser.correo_electronico
      }
    });

  } catch (error) {
    console.error('❌ Error eliminando al usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;
