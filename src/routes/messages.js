const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const adminAuth = require('../middlewares/adminAuth');
const messageController = require('../controllers/messageController');

// ===== RUTAS PÚBLICAS / SIN AUTH ESTRICTA =====

// ✅ OBTENER LISTA DE ADMINISTRADORES (para que usuarios puedan enviar mensajes)
router.get('/admins', async (req, res) => {
  try {
    const Admin = require('../models/admin');
    
    console.log('📋 Usuario solicitando lista de administradores');
    
    const admins = await Admin.find()
      .select('correo_electronico nombre_completo -contrasena')
      .lean();

    const adminsList = admins.map(admin => ({
      _id: admin._id,
      nombre: admin.nombre_completo || admin.correo_electronico,
      correo: admin.correo_electronico
    }));

    console.log(`✅ ${adminsList.length} admins encontrados`);

    res.json({
      success: true,
      admins: adminsList
    });

  } catch (error) {
    console.error('❌ Error obteniendo admins:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo administradores',
      error: error.message
    });
  }
});

// ===== RUTAS PARA USUARIOS Y ADMINS (requieren auth) =====

// GET /api/v1/messages - Obtener mis mensajes (para usuarios y admins)
router.get('/', auth, messageController.getMyMessages);

// GET /api/v1/messages/:id - Ver un mensaje específico
router.get('/:id', auth, messageController.getMessage);

// GET /api/messages/:id - Obtener un mensaje específico
router.get('/:id', auth, messageController.getMessageById);


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
