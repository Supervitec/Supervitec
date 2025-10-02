const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || '5up3r_v1t3c';  // En .env
const REFRESH_SECRET = process.env.REFRESH_SECRET || '5up3r_v1t3c';  // En .env

exports.register = async (req, res) => {
  try {
    const { nombre_completo, correo_electronico, contrasena, region, transporte } = req.body;
    
    console.log('📝 Intento de registro:', correo_electronico);

    // Validaciones manuales básicas
    if (!nombre_completo || !correo_electronico || !contrasena || !region || !transporte) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son requeridos'
      });
    }

    // Validaciones adicionales
    if (contrasena.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Verificar usuario existente
    const existingUser = await User.findOne({ correo_electronico: correo_electronico.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'El usuario ya existe'
      });
    }

    // ✅ CREAR USUARIO SIN HASH MANUAL 
    const newUser = new User({
      nombre_completo,
      correo_electronico: correo_electronico.toLowerCase(),
      contrasena, 
      region,
      transporte,
      rol: 'inspector',
      activo: true
    });

    await newUser.save(); // Aquí se ejecuta el middleware pre-save

    // ✅ GENERAR AMBOS TOKENS
    const token = jwt.sign(
      { id: newUser._id, correo_electronico: newUser.correo_electronico, rol: newUser.rol },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const refresh_token = jwt.sign(
      { id: newUser._id, correo_electronico: newUser.correo_electronico, rol: newUser.rol },
      REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ Usuario registrado:', correo_electronico);
    
    // ✅ RESPUESTA CORREGIDA CON REFRESH TOKEN Y ESTRUCTURA CONSISTENTE
    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token: token,
      refresh_token: refresh_token,  
      usuario: { 
        id: newUser._id, 
        nombre_completo: newUser.nombre_completo, 
        correo_electronico: newUser.correo_electronico, 
        rol: newUser.rol,
        region: newUser.region,
        transporte: newUser.transporte
      }
    });

  } catch (error) {
    console.error('❌ Error en registro:', error);
    
    // Manejo de errores específicos
    if (error.code === 11000) {
      return res.status(409).json({ 
        success: false, 
        message: 'El usuario ya existe' 
      });
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Datos de usuario inválidos',
        details: error.message
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
};


exports.login = async (req, res) => {
  try {
    const { correo_electronico, contrasena } = req.body;

    console.log('🔐 Intento de login:', correo_electronico);
    console.log('🔍 Password recibido (length):', contrasena?.length);
    console.log('🔍 Password tipo:', typeof contrasena);

    // Validaciones manuales básicas (sin express-validator)
    if (!correo_electronico || !contrasena) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario con contraseña
    const user = await User.findOne({ correo_electronico }).select('+contrasena');
    
    if (!user) {
      console.log('❌ Usuario no encontrado:', correo_electronico);
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    console.log('🔍 Usuario encontrado:', user._id);
    console.log('🔍 Hash almacenado (length):', user.contrasena?.length);
    console.log('🔍 Hash starts with $2b$:', user.contrasena?.startsWith('$2b$'));

    // Verificar cuenta activa
    if (!user.activo) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta desactivada'
      });
    }

    // Comparar contraseña con logs detallados
    console.log('🔍 Comparando contraseña...');
    const isValidPassword = await bcrypt.compare(contrasena, user.contrasena);
    console.log('🔍 Resultado comparación:', isValidPassword);

    if (!isValidPassword) {
      console.log('❌ Contraseña incorrecta para:', correo_electronico);
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // ✅ GENERAR AMBOS TOKENS
    const token = jwt.sign(
      { 
        id: user._id, 
        correo_electronico: user.correo_electronico, 
        rol: user.rol 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const refresh_token = jwt.sign(
      { 
        id: user._id, 
        correo_electronico: user.correo_electronico, 
        rol: user.rol 
      },
      REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Actualizar último acceso
    user.ultimo_acceso = new Date();
    await user.save();

    console.log('✅ Login exitoso para:', correo_electronico);
    
    // ✅ RESPUESTA CORREGIDA CON REFRESH TOKEN
    res.status(200).json({
      success: true,
      message: 'Login exitoso',
      token: token,
      refresh_token: refresh_token,  // ← AGREGAR ESTA LÍNEA
      usuario: {              
        id: user._id,
        nombre_completo: user.nombre_completo,
        correo_electronico: user.correo_electronico,
        rol: user.rol,
        region: user.region,
        transporte: user.transporte
      }
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Refresh token 
exports.refresh = async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ mensaje: 'Refresh token requerido' });

    const decoded = jwt.verify(refresh_token, REFRESH_SECRET);
    const payload = { id: decoded.id, correo_electronico: decoded.correo_electronico, rol: decoded.rol };
    const new_token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    const new_refresh_token = jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });

    res.json({ token: new_token, refresh_token: new_refresh_token });
  } catch (error) {
    res.status(401).json({ mensaje: 'Refresh token inválido' });
  }
};

// Solicitar recuperación de contraseña 
exports.solicitarRecuperacion = async (req, res) => {
  try {
    const { correo_electronico } = req.body;

    const user = await User.findOne({ correo_electronico });
    if (!user) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.tokenRecuperacion = token;
    user.expiraTokenRecuperacion = Date.now() + 3600000; // 1 hora
    await user.save();

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const urlReset = `${process.env.FRONTEND_URL}/auth/reset-password?token=${token}`;

    await transporter.sendMail({
      from: `"Soporte Supervitec" <${process.env.SMTP_USER}>`,
      to: user.correo_electronico,
      subject: 'Recuperación de contraseña',
      html: `
        <p>Para restablecer tu contraseña, haz clic en el siguiente enlace:</p>
        <p><a href="${urlReset}">${urlReset}</a></p>
      `,
    });

    res.json({ mensaje: 'Correo de recuperación enviado' });
  } catch (error) {
    console.error('Error en solicitar recuperación:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};

// Cambiar contraseña sin token 
exports.changePasswordLogged = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user || !await user.comparePassword(oldPassword)) {
      return res.status(401).json({ mensaje: 'Contraseña actual incorrecta' });
    }
    user.contrasena = newPassword;  
    await user.save();
    res.json({ mensaje: 'Contraseña cambiada correctamente' });
  } catch (error) {
    console.error('Error en cambio de contraseña:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};
