const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middlewares/adminAuth'); 
const { body } = require('express-validator');
const validarCampos = require('../middlewares/validarCampos');



// Login de administrador (NO requiere auth)
router.post('/login', adminController.adminLogin);
router.put(
  '/users/:id',
  adminAuth,
  [
    body('nombre_completo').optional().isString().withMessage('nombre_completo debe ser texto'),
    body('correo_electronico').optional().isEmail().withMessage('correo_electronico inválido'),
    // Agrega más validaciones según campos permitidos
  ],
  validarCampos,
  adminController.actualizarUsuario
);
router.put(
  '/movements/:id',
  adminAuth,
  [
    body('cantidad').optional().isNumeric().withMessage('cantidad debe ser un número'),
    body('descripcion').optional().isString().withMessage('descripcion debe ser texto'),
    body('tipo').optional().isIn(['ingreso', 'egreso']).withMessage('tipo inválido'),
    body('fecha').optional().isISO8601().toDate().withMessage('fecha inválida'),
    // Agrega más validaciones según tu esquema real
  ],
  validarCampos,
  adminController.actualizarMovimiento
);



// Todas las rutas protegidas usan adminAuth:
router.get('/users', adminAuth, adminController.getUsers);
router.delete('/users/:id', adminAuth, adminController.deleteUser);
router.delete('/movements/:id', adminAuth, adminController.deleteMovement);
router.get('/export/:month/:year', adminAuth, adminController.exportMovements);
router.get('/export/:month/:year/:region', adminAuth, adminController.exportMovements);

module.exports = router;
