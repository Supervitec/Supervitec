const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // De quién viene el mensaje
  from_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Para quién va el mensaje
  to_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Contenido del mensaje
  contenido: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  
  // Si fue leído o no
  leido: {
    type: Boolean,
    default: false
  },
  
  // Timestamp de creación
  fecha_creacion: {
    type: Date,
    default: Date.now
  },
  
  // Timestamp de lectura
  fecha_lectura: {
    type: Date,
    default: null
  },
  
  // Tipo de mensaje
  tipo: {
    type: String,
    enum: ['notificacion', 'alerta', 'general', 'reporte'],
    default: 'general'
  },
  
  // Para marcar como eliminado (soft delete)
  eliminado: {
    type: Boolean,
    default: false
  },
  
  // Asunto del mensaje (opcional)
  asunto: {
    type: String,
    default: 'Sin asunto'
  }
}, { timestamps: true });

// Índices para optimizar queries
messageSchema.index({ from_user_id: 1, fecha_creacion: -1 });
messageSchema.index({ to_user_id: 1, fecha_creacion: -1 });
messageSchema.index({ leido: 1, to_user_id: 1 });

module.exports = mongoose.model('Message', messageSchema);