import { Schema, model } from "mongoose";

// Esquema para los mensajes de chat
const chatMessageSchema = new Schema({
    // ID de la conversación a la que pertenece el mensaje
    conversationId: {
        type: String,
        required: true,
        index: true
    },
    // ID del remitente (puede ser 'admin' o el ID del cliente)
    senderId: {
        type: String,
        required: true
    },
    // Tipo de usuario que envía el mensaje
    senderType: {
        type: String,
        required: true,
        enum: ['admin', 'Customer']
    },
    // Contenido del mensaje
    message: {
        type: String,
        required: true,
        maxLength: 1000,
        trim: true
    },
    // Estado del mensaje
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read'],
        default: 'sent'
    },
    // Indica si el mensaje ha sido leído
    isRead: {
        type: Boolean,
        default: false
    },
    // Fecha y hora en que fue leído
    readAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true // Agrega createdAt y updatedAt automáticamente
});

// Índices para mejorar el rendimiento de las consultas
chatMessageSchema.index({ conversationId: 1, createdAt: -1 });
chatMessageSchema.index({ senderId: 1 });
chatMessageSchema.index({ isRead: 1 });

// Exportar el modelo
export default model("ChatMessage", chatMessageSchema); 