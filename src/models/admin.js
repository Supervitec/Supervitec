const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  nombre_completo: { type: String, required: true, unique: true },
  correo_electronico: { type: String, required: true, unique: true },
  contrasena: { type: String, required: true },
  permisos: { type: [String], default: ['read', 'write', 'delete', 'export'] },
  created_at: { type: Date, default: Date.now }
});

// Hash de la contraseña antes de guardar
adminSchema.pre('save', async function (next) {
  if (!this.isModified('contrasena')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.contrasena = await bcrypt.hash(this.contrasena, salt);
    next();
  } catch (err) {
    next(err);
  }
});

adminSchema.methods.comparecontrasena = function (contrasena) {
  return bcrypt.compare(contrasena, this.contrasena);
};

module.exports = mongoose.model('Admin', adminSchema);
