const mongoose = require('mongoose');

const movementSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Tipo de movimiento
  tipo_movimiento: {
    type: String,
    enum: ['recorrido_seguridad', 'inspeccion_rutinaria', 'emergencia', 'mantenimiento'],
    required: true,
    default: 'recorrido_seguridad'
  },
  // Estado del movimiento
  estado: {
    type: String,
    enum: ['iniciado', 'en_progreso', 'pausado', 'completado', 'cancelado'],
    default: 'iniciado'
  },
  start_location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    timestamp: { type: Date, required: true },
    // Dirección legible
    direccion: { type: String }
  },
  end_location: {
    latitude: { type: Number },
    longitude: { type: Number },
    timestamp: { type: Date },
    direccion: { type: String }
  },
  // Ruta seguida para tracking completo
  ruta_seguida: [{
    latitude: { type: Number },
    longitude: { type: Number },
    timestamp: { type: Date, default: Date.now }
  }],
  distancia_recorrida: { type: Number, default: 0 },     // km
  velocidad_promedio: { type: Number, default: 0 },      // km/h
  velocidad_maxima: { type: Number, default: 0 },        // km/h
  tiempo_total: { type: Number, default: 0 },            // minutos
  fecha: { type: Date, required: true, default: Date.now },
  // Fecha de finalización
  fecha_fin: { type: Date },
  region: { 
    type: String, 
    enum: ['Caldas', 'Risaralda', 'Quindío'], 
    required: true 
  },
  // Transporte utilizado
  transporte_utilizado: {
    type: String,
    enum: ['moto', 'carro'],
    required: true
  },
  // Observaciones para reportes SST
  observaciones: {
    type: String,
    maxlength: 500
  },
  // Incidentes reportados durante el recorrido
  incidentes: [{
    tipo: {
      type: String,
      enum: ['riesgo_detectado', 'accidente', 'falla_equipo', 'otro']
    },
    descripcion: String,
    ubicacion: {
      latitude: Number,
      longitude: Number
    },
    timestamp: { type: Date, default: Date.now },
    gravedad: {
      type: String,
      enum: ['baja', 'media', 'alta', 'critica'],
      default: 'media'
    }
  }],
  // Soft delete
  activo: {
    type: Boolean,
    default: true
  },
  created_at: { type: Date, default: Date.now },
});

// Índices optimizados para consultas frecuentes
movementSchema.index({ user_id: 1, fecha: -1 });
movementSchema.index({ estado: 1 });
movementSchema.index({ region: 1 });
movementSchema.index({ tipo_movimiento: 1 });
movementSchema.index({ activo: 1 });

// Método para calcular duración automáticamente
movementSchema.methods.calcularDuracion = function() {
  if (this.fecha_fin && this.fecha) {
    const duracionMs = this.fecha_fin - this.fecha;
    this.tiempo_total = Math.round(duracionMs / (1000 * 60)); // minutos
  }
  return this.tiempo_total;
};

// Método para validar completitud
movementSchema.methods.puedeCompletar = function() {
  return ['iniciado', 'en_progreso', 'pausado'].includes(this.estado);
};

// Virtual para obtener duración en horas
movementSchema.virtual('duracion_horas').get(function() {
  return this.tiempo_total ? (this.tiempo_total / 60).toFixed(2) : 0;
});

module.exports = mongoose.model('Movement', movementSchema);
