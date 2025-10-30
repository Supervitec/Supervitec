const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');
const messageController = require('../controllers/messageController');

// ===== RUTAS PARA USUARIOS Y ADMINS =====

// GET /api/v1/messages - Obtener mis mensajes (para usuarios y admins)
router.get('/', auth, messageController.getMyMessages);

// GET /api/v1/messages/:id - Ver un mensaje específico
router.get('/:id', auth, messageController.getMessage);

// POST /api/v1/messages - Enviar nuevo mensaje
router.post('/', auth, messageController.sendMessage);

// PUT /api/v1/messages/:id/read - Marcar como leído
router.put('/:id/read', auth, messageController.markAsRead);

// PUT /api/v1/messages/mark-all-read - Marcar todos como leídos
router.put('/mark-all-read', auth, messageController.markAllAsRead);

// DELETE /api/v1/messages/:id - Eliminar mensaje
router.delete('/:id', auth, messageController.deleteMessage);

// ===== RUTAS SOLO PARA ADMIN =====

// GET /api/v1/messages/admin/all - Admin obtiene todos los mensajes
router.get('/admin/all', adminAuth, messageController.adminGetAllMessages);

// GET /api/v1/messages/admin/user/:userId - Admin obtiene mensajes de un usuario
router.get('/admin/user/:userId', adminAuth, messageController.adminGetUserMessages);

module.exports = router;