// backend/routes/message.routes.js
const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// Enviar mensaje/reporte
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { recipientId, subject, message, isReply, originalMessageId } = req.body;
    const senderId = req.user.id;

    // Validaciones
    if (!recipientId || !subject || !message) {
      return res.status(400).json({ message: 'Faltan datos requeridos' });
    }

    // Verificar que el destinatario existe
    const recipient = await User.findById(recipientId);
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
      recipient: recipientId,
      subject,
      message,
      isReply: isReply || false,
      originalMessage: originalMessageId || null
    });

    await newMessage.save();

    // Poblar datos de sender y recipient
    await newMessage.populate('sender', 'nombre_completo correo_electronico');
    await newMessage.populate('recipient', 'nombre_completo correo_electronico');

    res.status(201).json({
      message: 'Mensaje enviado exitosamente',
      data: newMessage
    });
  } catch (error) {
    console.error('Error enviando mensaje:', error);
    res.status(500).json({ message: 'Error al enviar mensaje', error: error.message });
  }
});

// Obtener mensajes recibidos
router.get('/inbox', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const messages = await Message.find({ recipient: userId })
      .populate('sender', 'nombre_completo correo_electronico rol')
      .sort({ createdAt: -1 });

    const unreadCount = messages.filter(msg => !msg.isRead).length;

    res.json({
      messages,
      unreadCount
    });
  } catch (error) {
    console.error('Error obteniendo mensajes:', error);
    res.status(500).json({ message: 'Error al obtener mensajes' });
  }
});

// Obtener mensajes enviados
router.get('/sent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const messages = await Message.find({ sender: userId })
      .populate('recipient', 'nombre_completo correo_electronico rol')
      .sort({ createdAt: -1 });

    res.json({ messages });
  } catch (error) {
    console.error('Error obteniendo mensajes enviados:', error);
    res.status(500).json({ message: 'Error al obtener mensajes' });
  }
});

// Marcar mensaje como leído
router.put('/:messageId/read', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findOne({ 
      _id: messageId, 
      recipient: userId 
    });

    if (!message) {
      return res.status(404).json({ message: 'Mensaje no encontrado' });
    }

    message.isRead = true;
    await message.save();

    res.json({ message: 'Mensaje marcado como leído' });
  } catch (error) {
    console.error('Error marcando mensaje:', error);
    res.status(500).json({ message: 'Error al marcar mensaje' });
  }
});

// Obtener administradores (para usuarios que quieren enviar reporte)
router.get('/admins', authenticateToken, async (req, res) => {
  try {
    const admins = await User.find({ rol: 'admin' })
      .select('nombre_completo correo_electronico');

    res.json({ admins });
  } catch (error) {
    console.error('Error obteniendo administradores:', error);
    res.status(500).json({ message: 'Error al obtener administradores' });
  }
});

module.exports = router;
