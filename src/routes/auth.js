const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { body } = require('express-validator');
const validarCampos = require('../middlewares/validarCampos'); 
const { register, login, solicitarRecuperacion, changePasswordLogged } = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/auth');


//  ENDPOINTS USANDO CONTROLADORES 
router.post('/register', register);
router.post('/login', login);

router.post(
  '/recuperar-password',
  [body('correo_electronico').isEmail().withMessage('Correo electrónico inválido')],
  validarCampos,
  solicitarRecuperacion
);

router.post(
  '/change-password',
  [
    body('token').notEmpty().withMessage('Token es requerido'),
    body('nuevaPassword').isLength({ min: 6 }).withMessage('La nueva contraseña debe tener al menos 6 caracteres')
  ],
  validarCampos,
  changePasswordLogged
);

router.put('/change-password-logged', authMiddleware, changePasswordLogged);

// POST /api/v1/auth/request-password-reset - Solicitar reset de contraseña
router.post('/request-password-reset', async (req, res) => {
  try {
    const { correo_electronico } = req.body;
    console.log('📧 Solicitud de reset para email:', correo_electronico);

    // Validar que se proporcionó email
    if (!correo_electronico) {
      return res.status(400).json({
        success: false,
        message: 'Correo electrónico es requerido'
      });
    }

    // Buscar usuario por email
    const user = await User.findOne({ correo_electronico: correo_electronico.toLowerCase() });
    
    if (!user) {
      // Por seguridad, no revelar si el email existe o no
      console.log(' Email no encontrado:', correo_electronico);
      return res.status(200).json({
        success: true,
        message: 'Si el correo existe en nuestro sistema, se enviará un enlace de recuperación'
      });
    }

    // Generar token seguro de 32 bytes
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Configurar token y expiración (1 hora)
    user.tokenRecuperacion = resetToken;
    user.expiraTokenRecuperacion = new Date(Date.now() + 3600000); // 1 hora
    
    await user.save();
    console.log(' Token generado para usuario:', user.nombre_completo);

    // Crear URL de recuperación
    const resetUrl = `https://back-end-fjnh.onrender.com/api/v1/auth/reset-password?token=${resetToken}`;
    
    // Configurar email con Ethereal
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: correo_electronico,
      subject: 'Recuperación de Contraseña - SupervitecApp',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Recuperación de Contraseña</h2>
          <p>Hola <strong>${user.nombre_completo}</strong>,</p>
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en SupervitecApp.</p>
          <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Restablecer Contraseña
            </a>
          </div>
          <p><strong>Importante:</strong></p>
          <ul>
            <li>Este enlace es válido por <strong>1 hora</strong></li>
            <li>Si no solicitaste este cambio, ignora este email</li>
          </ul>
          <p>Token para testing: <code>${resetToken}</code></p>
          <hr style="margin: 30px 0;">
          <p style="color: #888; font-size: 12px;">SupervitecApp - Sistema SST</p>
        </div>
      `
    };

    // Enviar email
    const info = await transporter.sendMail(mailOptions);
    console.log(' Email enviado. Preview URL:', nodemailer.getTestMessageUrl(info));

    res.json({
      success: true,
      message: 'Si el correo existe en nuestro sistema, se enviará un enlace de recuperación',
      //  Para testing con Ethereal - mostrar preview URL
      previewUrl: nodemailer.getTestMessageUrl(info)
    });

  } catch (error) {
    console.error(' Error en request-password-reset:', error);
    
    if (error.code === 'EAUTH' || error.code === 'ESOCKET') {
      return res.status(500).json({
        success: false,
        message: 'Error del servicio de email. Contacte al administrador.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// POST /api/v1/auth/reset-password - Confirmar cambio de contraseña
router.post('/reset-password', async (req, res) => {
  try {
    const { token, nuevaContrasena } = req.body;
    console.log('🔑 Intento de reset con token:', token?.substring(0, 8) + '...');

    // Validar datos requeridos
    if (!token || !nuevaContrasena) {
      return res.status(400).json({
        success: false,
        message: 'Token y nueva contraseña son requeridos'
      });
    }

    // Validar longitud mínima de contraseña
    if (nuevaContrasena.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Buscar usuario con token válido y no expirado
    const user = await User.findOne({
      tokenRecuperacion: token,
      expiraTokenRecuperacion: { $gt: new Date() } // Token no expirado
    });

    if (!user) {
      console.log(' Token inválido o expirado:', token?.substring(0, 8));
      return res.status(400).json({
        success: false,
        message: 'El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo.'
      });
    }

    console.log(' Token válido para usuario:', user.nombre_completo);

    // Actualizar contraseña (el middleware pre-save se encarga del hash)
    user.contrasena = nuevaContrasena;
    
    // Limpiar token para evitar reutilización
    user.tokenRecuperacion = undefined;
    user.expiraTokenRecuperacion = undefined;
    
    // Actualizar último acceso
    user.ultimo_acceso = new Date();

    await user.save();
    console.log(' Contraseña actualizada para:', user.correo_electronico);

    res.json({
      success: true,
      message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.'
    });

  } catch (error) {
    console.error(' Error en reset-password:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

//  MANTENER: GET para testing con formulario HTML
router.get('/reset-password', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).send('Token requerido');
    }

    // Verificar que el token existe y no ha expirado
    const user = await User.findOne({
      tokenRecuperacion: token,
      expiraTokenRecuperacion: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #ef4444;">Token Inválido o Expirado</h2>
            <p>El enlace de recuperación ha expirado o no es válido.</p>
            <p>Por favor, solicita un nuevo enlace de recuperación.</p>
          </body>
        </html>
      `);
    }

    // Mostrar formulario para nueva contraseña
    res.send(`
      <html>
        <head>
          <title>Restablecer Contraseña - SupervitecApp</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; }
            .form-group { margin-bottom: 15px; }
            label { display: block; margin-bottom: 5px; font-weight: bold; }
            input[type="password"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
            button { background-color: #2563eb; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; width: 100%; }
            button:hover { background-color: #1d4ed8; }
          </style>
        </head>
        <body>
          <h2>Restablecer Contraseña</h2>
          <p>Hola <strong>${user.nombre_completo}</strong>, ingresa tu nueva contraseña:</p>
          
          <form method="POST" action="/api/v1/auth/reset-password">
            <input type="hidden" name="token" value="${token}" />
            
            <div class="form-group">
              <label for="nuevaContrasena">Nueva Contraseña:</label>
              <input type="password" name="nuevaContrasena" id="nuevaContrasena" 
                     placeholder="Mínimo 6 caracteres" minlength="6" required />
            </div>
            
            <button type="submit">Cambiar Contraseña</button>
          </form>
          
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            SupervitecApp - Sistema de Seguridad y Salud en el Trabajo
          </p>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Error en GET reset-password:', error);
    res.status(500).send('Error interno del servidor');
  }
});


module.exports = router;
