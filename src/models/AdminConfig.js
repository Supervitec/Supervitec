const mongoose = require('mongoose');

const adminConfigSchema = new mongoose.Schema({
  // Config única por admin
  admin_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  
  // Configuración General
  notificacionesPush: {
    enabled: { type: Boolean, default: true },
    lastUpdated: { type: Date, default: Date.now },
  },
  
  reportesAutomaticos: {
    enabled: { type: Boolean, default: false },
    frecuencia: { 
      type: String, 
      enum: ['diario', 'semanal', 'mensual'], 
      default: 'diario' 
    },
    hora: { type: String, default: '08:00' }, // Formato HH:MM
    ultimoReporte: { type: Date },
    lastUpdated: { type: Date, default: Date.now },
  },
  
  backupAutomatico: {
    enabled: { type: Boolean, default: true },
    frecuencia: { 
      type: String, 
      enum: ['diario', 'semanal'], 
      default: 'diario' 
    },
    hora: { type: String, default: '02:00' },
    ultimoBackup: { type: Date },
    lastUpdated: { type: Date, default: Date.now },
  },
  
  // Seguridad
  alertasDeSeguridad: {
    enabled: { type: Boolean, default: true },
    lastUpdated: { type: Date, default: Date.now },
  },
}, {
  timestamps: true,
});

// Método para obtener o crear configuración
adminConfigSchema.statics.getOrCreateConfig = async function(adminId) {
  let config = await this.findOne({ admin_id: adminId });
  
  if (!config) {
    config = await this.create({ admin_id: adminId });
    console.log(' Configuración creada para admin:', adminId);
  }
  
  return config;
};

module.exports = mongoose.model('AdminConfig', adminConfigSchema);
