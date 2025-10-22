// backend/routes/messages.js (o message.routes.js)
const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const { authMiddleware } = require('../middlewares/auth');

// Enviar mensaje/reporte
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { recipientId, subject, message, isReply, originalMessageId, priority } = req.body;
    const senderId = req.user.id;

    // Validaciones
    if (!subject || !message) {
      return res.status(400).json({ message: 'Faltan datos requeridos' });
    }

    let finalRecipientId = recipientId;

    // Si no hay recipientId, buscar un admin automáticamente
    if (!recipientId) {
      const admin = await User.findOne({ rol: 'admin', activo: true });
      if (!admin) {
        return res.status(404).json({ message: 'No hay administradores disponibles' });
      }
      finalRecipientId = admin._id;
    }

    // Verificar que el destinatario existe
    const recipient = await User.findById(finalRecipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'Destinatario no encontrado' });
    }

    // Verificar permisos: usuarios solo pueden enviar a admins
    const sender = await User.findById(senderId);
    if (sender.rol !== 'admin' && recipient.rol !== 'admin') {
      return res.status(403).json({ 
        message: 'Solo puedes enviar mensajes a administradores' 
      });
    }

    const newMessage = new Message({
      sender: senderId,
      recipient: finalRecipientId,
      subject,
      message,
      priority: priority || 'normal', // ✅ NUEVO
      isReply: isReply || false,
      originalMessage: originalMessageId || null
    });

    await newMessage.save();

    // Poblar datos completos
    await newMessage.populate('sender', 'nombre_completo correo_electronico rol region transporte');
    await newMessage.populate('recipient', 'nombre_completo correo_electronico rol');

    res.status(201).json({
      success: true, // ✅ AÑADIDO para consistencia
      message: 'Mensaje enviado exitosamente',
      data: newMessage
    });
  } catch (error) {
    console.error('Error enviando mensaje:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al enviar mensaje', 
      error: error.message 
    });
  }
});

// Obtener mensajes recibidos (INBOX)
router.get('/inbox', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const messages = await Message.find({ recipient: userId })
      .populate('sender', 'nombre_completo correo_electronico rol region transporte')
      .sort({ createdAt: -1 });

    const unreadCount = messages.filter(msg => !msg.isRead).length;

    res.json({
      success: true,
      messages,
      unreadCount
    });
  } catch (error) {
    console.error('Error obteniendo mensajes:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener mensajes' 
    });
  }
});

// Obtener mensajes enviados
router.get('/sent', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const messages = await Message.find({ sender: userId })
      .populate('recipient', 'nombre_completo correo_electronico rol')
      .sort({ createdAt: -1 });

    res.json({ 
      success: true,
      messages 
    });
  } catch (error) {
    console.error('Error obteniendo mensajes enviados:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener mensajes' 
    });
  }
});

// ✅ NUEVO: Obtener mensaje específico por ID
router.get('/:messageId', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findOne({ 
      _id: messageId,
      $or: [
        { sender: userId },
        { recipient: userId }
      ]
    })
    .populate('sender', 'nombre_completo correo_electronico rol region transporte')
    .populate('recipient', 'nombre_completo correo_electronico rol');

    if (!message) {
      return res.status(404).json({ 
        success: false,
        message: 'Mensaje no encontrado' 
      });
    }

    res.json({
      success: true,
      message: message,
      data: message
    });
  } catch (error) {
    console.error('Error obteniendo mensaje:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener mensaje' 
    });
  }
});

// Marcar mensaje como leído
router.put('/:messageId/read', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findOne({ 
      _id: messageId, 
      recipient: userId 
    });

    if (!message) {
      return res.status(404).json({ 
        success: false,
        message: 'Mensaje no encontrado' 
      });
    }

    message.isRead = true;
    await message.save();

    res.json({ 
      success: true,
      message: 'Mensaje marcado como leído',
      data: message
    });
  } catch (error) {
    console.error('Error marcando mensaje:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al marcar mensaje' 
    });
  }
});

// ✅ NUEVO: Eliminar mensaje (solo admin)
router.delete('/:messageId', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // Verificar si es admin
    const user = await User.findById(userId);
    if (user.rol !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'No tienes permisos para eliminar mensajes' 
      });
    }

    const message = await Message.findByIdAndDelete(messageId);

    if (!message) {
      return res.status(404).json({ 
        success: false,
        message: 'Mensaje no encontrado' 
      });
    }

    res.json({ 
      success: true,
      message: 'Mensaje eliminado correctamente' 
    });
  } catch (error) {
    console.error('Error eliminando mensaje:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al eliminar mensaje' 
    });
  }
});

// Obtener administradores (para usuarios que quieren enviar reporte)
router.get('/admins', authMiddleware, async (req, res) => {
  try {
    const admins = await User.find({ rol: 'admin', activo: true })
      .select('nombre_completo correo_electronico');

    res.json({ 
      success: true,
      admins 
    });
  } catch (error) {
    console.error('Error obteniendo administradores:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener administradores' 
    });
  }
});

module.exports = router;
