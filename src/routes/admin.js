const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middlewares/adminAuth'); 
const { body } = require('express-validator');
const validarCampos = require('../middlewares/validarCampos');

// ===== LOGIN (NO requiere auth) =====
router.post('/login', adminController.adminLogin);

// ===== GESTIÓN DE USUARIOS (requieren auth) =====
router.get('/users', adminAuth, adminController.getUsers);

router.put(
  '/users/:id',
  adminAuth,
  [
    body('nombre_completo').optional().isString().withMessage('nombre_completo debe ser texto'),
    body('correo_electronico').optional().isEmail().withMessage('correo_electronico inválido'),
  ],
  validarCampos,
  adminController.actualizarUsuario
);

router.delete('/users/:id', adminAuth, adminController.deleteUser);

// Obtener estadísticas de un usuario específico
router.get('/users/:id/stats', adminAuth, adminController.getUserStats);

// Obtener movimientos de un usuario específico
router.get('/users/:id/movements', adminAuth, adminController.getUserMovements);

// ===== GESTIÓN DE MOVIMIENTOS (requieren auth) =====
router.get('/movements', adminAuth, adminController.getMovements);

router.put(
  '/movements/:id',
  adminAuth,
  [
    body('distancia_recorrida').optional().isNumeric().withMessage('distancia_recorrida debe ser un número'),
    body('velocidad_promedio').optional().isNumeric().withMessage('velocidad_promedio debe ser un número'),
    body('velocidad_maxima').optional().isNumeric().withMessage('velocidad_maxima debe ser un número'),
    body('tiempo_total').optional().isNumeric().withMessage('tiempo_total debe ser un número'),
    body('fecha').optional().isISO8601().toDate().withMessage('fecha inválida'),
    body('region').optional().isString().withMessage('region debe ser texto'),
  ],
  validarCampos,
  adminController.actualizarMovimiento
);

router.delete('/movements/:id', adminAuth, adminController.deleteMovement);

// ===== EXPORTACIÓN (requiere auth) =====
router.get('/export/:month/:year', adminAuth, adminController.exportMovements);
router.get('/export/:month/:year/:region', adminAuth, adminController.exportMovements);

// ===== CONFIGURACIÓN DEL ADMINISTRADOR =====
router.get('/config', adminAuth, adminController.getAdminConfig);
router.put('/config', adminAuth, adminController.updateAdminConfig);

router.post('/change-user-password', adminAuth, adminController.changeUserPassword);

router.post('/export-all-data', adminAuth, adminController.exportAllData);
router.post('/reset-system', adminAuth, adminController.resetSystem);

router.post('/change-user-password', adminAuth, adminController.changeUserPassword);

// ===== GESTIÓN DE USUARIOS =====
router.get('/users/management', adminAuth, adminController.getAllUsersForManagement);
router.put('/users/edit/:userId', adminAuth, adminController.editUser);
router.delete('/users/delete/:userId', adminAuth, adminController.deleteUserPermanently);
router.post('/users/create', adminAuth, adminController.createUser);

// ===== SISTEMA =====
router.post('/export-all-data', adminAuth, adminController.exportAllData);
router.post('/reset-system', adminAuth, adminController.resetSystem);

module.exports = router;
