const Message = require('../models/Message');
const User = require('../models/User');
const mongoose = require('mongoose');

// ===== OBTENER MENSAJES =====

exports.getMyMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { leido, limit = 20, skip = 0 } = req.query;
    
    console.log('📨 GET /messages - Usuario:', userId);
    
    // ✅ Determinar el tipo de usuario
    const Admin = require('../models/admin');
    let userAdmin = await Admin.findById(userId);
    let userUser = await User.findById(userId);
    
    let user_type;
    if (userAdmin) {
      user_type = 'Admin';
    } else if (userUser && userUser.rol === 'admin') {
      user_type = 'Admin';
    } else if (userUser) {
      user_type = 'User';
    } else {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    console.log('📨 Tipo de usuario:', user_type);
    
    // Filtros
    let filter = {
      to_user_id: userId,
      to_user_type: user_type, // ✅ Filtrar por tipo también
      eliminado: false
    };
    
    if (leido === 'true') {
      filter.leido = true;
    } else if (leido === 'false') {
      filter.leido = false;
    }
    
    // Obtener mensajes con paginación
    const messages = await Message.find(filter)
      .populate('from_user_id')
      .sort({ fecha_creacion: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();
    
    // Contar total
    const total = await Message.countDocuments(filter);
    
    // Contar no leídos
    const noLeidos = await Message.countDocuments({
      to_user_id: userId,
      to_user_type: user_type,
      leido: false,
      eliminado: false
    });
    
    console.log(`✅ ${messages.length} mensajes encontrados (${noLeidos} no leídos)`);
    
    return res.json({
      success: true,
      message: 'Mensajes obtenidos correctamente',
      data: messages,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        pages: Math.ceil(total / parseInt(limit))
      },
      noLeidos
    });
    
  } catch (error) {
    console.error('❌ Error en getMyMessages:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener mensajes',
      error: error.message
    });
  }
};

// GET /api/messages/:id - Ver mensaje específico
exports.getMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log('📨 GET /messages/:id - Mensaje:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de mensaje inválido'
      });
    }

    const message = await Message.findById(id)
      .populate('from_user_id', 'nombre_completo correo_electronico rol')
      .populate('to_user_id', 'nombre_completo correo_electronico rol');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Mensaje no encontrado'
      });
    }

    // Verificar que el usuario sea el destinatario
    if (message.to_user_id._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver este mensaje'
      });
    }

    // Marcar como leído
    if (!message.leido) {
      message.leido = true;
      message.fecha_lectura = new Date();
      await message.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Mensaje obtenido',
      data: message
    });
  } catch (error) {
    console.error('❌ Error en getMessage:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener mensaje',
      error: error.message
    });
  }
};

// ===== CREAR MENSAJES =====

// POST /api/messages - Enviar mensaje
exports.sendMessage = async (req, res) => {
  try {
    const { to_user_id, to_user_type, contenido, asunto, tipo } = req.body;
    const from_user_id = req.user.id;
    
    console.log('📤 POST /messages - De:', from_user_id, 'Para:', to_user_id, 'Tipo:', to_user_type);
    
    // Validaciones
    if (!to_user_id || !contenido) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: to_user_id y contenido'
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(to_user_id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario destino inválido'
      });
    }
    
    // ✅ Determinar el tipo de remitente (buscar en ambas colecciones)
    const Admin = require('../models/admin');
    
    let remitenteAdmin = await Admin.findById(from_user_id);
    let remitenteUser = await User.findById(from_user_id);
    
    let from_user_type;
    let remitente;
    
    if (remitenteAdmin) {
      from_user_type = 'Admin';
      remitente = remitenteAdmin;
    } else if (remitenteUser && remitenteUser.rol === 'admin') {
      // ✅ Si es un User con rol admin, tratarlo como Admin
      from_user_type = 'Admin';
      remitente = remitenteUser;
    } else if (remitenteUser) {
      from_user_type = 'User';
      remitente = remitenteUser;
    } else {
      return res.status(404).json({
        success: false,
        message: 'Remitente no encontrado'
      });
    }
    
    console.log('📤 Remitente:', from_user_type, remitente.correo_electronico || remitente.nombre_completo);
    
    // ✅ Buscar destinatario (buscar en ambas colecciones)
    let destinatario;
    let destinatario_type;
    
    // Primero buscar en Admin
    let destinatarioAdmin = await Admin.findById(to_user_id);
    let destinatarioUser = await User.findById(to_user_id);
    
    if (destinatarioAdmin) {
      destinatario = destinatarioAdmin;
      destinatario_type = 'Admin';
    } else if (destinatarioUser && destinatarioUser.rol === 'admin') {
      // ✅ Si es un User con rol admin, tratarlo como Admin
      destinatario = destinatarioUser;
      destinatario_type = 'Admin';
    } else if (destinatarioUser) {
      destinatario = destinatarioUser;
      destinatario_type = 'User';
    } else {
      console.error('❌ Destinatario no encontrado en ninguna colección:', to_user_id);
      return res.status(404).json({
        success: false,
        message: 'Usuario destino no encontrado'
      });
    }
    
    console.log('📤 Destinatario:', destinatario_type, destinatario.correo_electronico || destinatario.nombre_completo);
    
    // Crear el mensaje
    const nuevoMensaje = new Message({
      from_user_id,
      from_user_type,
      to_user_id,
      to_user_type: destinatario_type,
      contenido,
      asunto: asunto || 'Sin asunto',
      tipo: tipo || 'general'
    });
    
    await nuevoMensaje.save();
    
    // Poblar referencias dinámicamente
    await nuevoMensaje.populate('from_user_id');
    await nuevoMensaje.populate('to_user_id');
    
    console.log('✅ Mensaje enviado:', nuevoMensaje._id);
    
    return res.status(201).json({
      success: true,
      message: 'Mensaje enviado correctamente',
      data: nuevoMensaje
    });
    
  } catch (error) {
    console.error('❌ Error en sendMessage:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al enviar mensaje',
      error: error.message
    });
  }
};


// ===== MARCAR COMO LEÍDO =====

// PUT /api/messages/:id/read - Marcar un mensaje como leído
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log('✅ PUT /messages/:id/read - Mensaje:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de mensaje inválido'
      });
    }

    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Mensaje no encontrado'
      });
    }

    // Verificar que el usuario sea el destinatario
    if (message.to_user_id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para marcar este mensaje'
      });
    }

    message.leido = true;
    message.fecha_lectura = new Date();
    await message.save();

    return res.status(200).json({
      success: true,
      message: 'Mensaje marcado como leído',
      data: message
    });
  } catch (error) {
    console.error('❌ Error en markAsRead:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al marcar mensaje como leído',
      error: error.message
    });
  }
};

// PUT /api/messages/mark-all-read - Marcar todos como leídos
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('✅ PUT /messages/mark-all-read - Usuario:', userId);

    const result = await Message.updateMany(
      { to_user_id: userId, leido: false, eliminado: false },
      { 
        $set: { 
          leido: true,
          fecha_lectura: new Date()
        }
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Todos los mensajes marcados como leídos',
      data: result
    });
  } catch (error) {
    console.error('❌ Error en markAllAsRead:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al marcar mensajes como leídos',
      error: error.message
    });
  }
};

// ===== ELIMINAR MENSAJES =====

// DELETE /api/messages/:id - Eliminar (soft delete)
exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log('🗑️ DELETE /messages/:id - Mensaje:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de mensaje inválido'
      });
    }

    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Mensaje no encontrado'
      });
    }

    // El usuario solo puede eliminar sus propios mensajes recibidos
    if (message.to_user_id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar este mensaje'
      });
    }

    // Soft delete
    message.eliminado = true;
    await message.save();

    return res.status(200).json({
      success: true,
      message: 'Mensaje eliminado correctamente'
    });
  } catch (error) {
    console.error('❌ Error en deleteMessage:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar mensaje',
      error: error.message
    });
  }
};

// ===== FUNCIONES ESPECIALES PARA ADMIN =====

// GET /api/admin/messages - Admin obtiene TODOS los mensajes (enviados y recibidos)
exports.adminGetAllMessages = async (req, res) => {
  try {
    const { leido, limit = 20, skip = 0, tipo } = req.query;
    const adminId = req.user.id;

    console.log('📨 GET /admin/messages - Admin:', adminId);

    let filter = {
      $or: [
        { from_user_id: adminId },
        { to_user_id: adminId }
      ],
      eliminado: false
    };

    if (leido === 'true') {
      filter.leido = true;
    } else if (leido === 'false') {
      filter.leido = false;
    }

    if (tipo) {
      filter.tipo = tipo;
    }

    const messages = await Message.find(filter)
      .populate('from_user_id', 'nombre_completo correo_electronico rol')
      .populate('to_user_id', 'nombre_completo correo_electronico rol')
      .sort({ fecha_creacion: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await Message.countDocuments(filter);
    const noLeidos = await Message.countDocuments({
      to_user_id: adminId,
      leido: false,
      eliminado: false
    });

    return res.status(200).json({
      success: true,
      message: 'Mensajes obtenidos',
      data: messages,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        pages: Math.ceil(total / limit)
      },
      noLeidos
    });
  } catch (error) {
    console.error('❌ Error en adminGetAllMessages:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener mensajes',
      error: error.message
    });
  }
};

// GET /api/admin/messages/user/:userId - Admin obtiene mensajes de un usuario específico
exports.adminGetUserMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, skip = 0 } = req.query;

    console.log('📨 GET /admin/messages/user/:userId - Usuario:', userId);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido'
      });
    }

    const messages = await Message.find({
      $or: [
        { from_user_id: userId },
        { to_user_id: userId }
      ],
      eliminado: false
    })
      .populate('from_user_id', 'nombre_completo correo_electronico rol')
      .populate('to_user_id', 'nombre_completo correo_electronico rol')
      .sort({ fecha_creacion: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await Message.countDocuments({
      $or: [
        { from_user_id: userId },
        { to_user_id: userId }
      ],
      eliminado: false
    });

    return res.status(200).json({
      success: true,
      message: 'Mensajes del usuario obtenidos',
      data: messages,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('❌ Error en adminGetUserMessages:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener mensajes',
      error: error.message
    });
  }
};