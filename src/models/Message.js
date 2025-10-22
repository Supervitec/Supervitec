// backend/models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 2000
  },
  priority: {  // ✅ NUEVO CAMPO
    type: String,
    enum: ['normal', 'high', 'urgent'],
    default: 'normal'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isReply: {
    type: Boolean,
    default: false
  },
  reply: {  // ✅ NUEVO: Para almacenar la respuesta del admin
    type: String,
    maxlength: 2000
  },
  repliedAt: {  // ✅ NUEVO: Fecha de respuesta
    type: Date
  },
  repliedBy: {  // ✅ NUEVO: Quién respondió
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  hasReply: {  // ✅ NUEVO: Flag de si tiene respuesta
    type: Boolean,
    default: false
  },
  originalMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true  
});

module.exports = mongoose.model('Message', messageSchema);
