const express = require('express');
const router = express.Router();
const authRoutes = require('./auth').default;
const movementRoutes = require('./movements');
const adminRoutes = require('./admin').default;

// Ruta de prueba
router.get('/', (req, res) => {
    res.json({ mensaje: 'Servidor Express funcionando correctamente 🚀' });
});

// Rutas de autenticación
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/movements', movementRoutes);

module.exports = router;
