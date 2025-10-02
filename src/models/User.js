const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  nombre_completo: {
    type: String,
    required: true,
    trim: true
  },
  correo_electronico: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  contrasena: {
    type: String,
    required: true
  },
  region: {
    type: String,
    enum: ['Caldas', 'Risaralda', 'Quindío'],
    required: true
  },
  transporte: {
    type: String,
    enum: ['moto', 'carro'],
    required: true
  },
  rol: {
    type: String,
    enum: ['ingeniero', 'inspector', 'admin'],
    required: true
  },
  activo: {
    type: Boolean,
    default: true
  },
  ultimo_acceso: {
    type: Date,
    default: Date.now
  },
  tokenRecuperacion: {
    type: String
  },
  expiraTokenRecuperacion: {
    type: Date
  },
  ultima_actividad:{
    type: Date,
    default: Date.now
  },
  refresh_token: {
    type: String,
    default: null
  },
  token_expira: {
    type: Date,
    default: null
  },
  sesiones_activas:{
    token_id: String,
    ip: String,
    user_agent: String,
    created_at: {type: Date, default: Date.now},
    last_activity: {type: Date, default: Date.now}
  },
});

// método para limpiar sesiones expiradas
userSchema.methods.limpiarSesionesExpiradas = function() {
  const ahora = new Date();
  const tiempoMaximoInactividad = 30 * 60 * 1000; // 30 minutos
  
  this.sesiones_activas = this.sesiones_activas.filter(sesion => {
    return (ahora - sesion.last_activity) < tiempoMaximoInactividad;
  });
  
  return this.save();
};

// método para registrar actividad
userSchema.methods.registrarActividad = function(tokenId, ip, userAgent) {
  this.ultima_actividad = new Date();
  
  // Actualizar o crear sesión
  const sesionExistente = this.sesiones_activas.find(s => s.token_id === tokenId);
  
  if (sesionExistente) {
    sesionExistente.last_activity = new Date();
  } else {
    this.sesiones_activas.push({
      token_id: tokenId,
      ip: ip,
      user_agent: userAgent,
      last_activity: new Date()
    });
  }
  
  return this.save();
};

// Middleware para hashear contraseña antes de guardar
userSchema.pre('save', async function (next) {
  if (!this.isModified('contrasena')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.contrasena = await bcrypt.hash(this.contrasena, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar contraseñas durante login
userSchema.methods.comparePassword = function (contrasena) {
  return bcrypt.compare(contrasena, this.contrasena);
};


module.exports = mongoose.model('User', userSchema);
