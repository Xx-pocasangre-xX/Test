// Importar Schema y model de mongoose para crear el modelo de base de datos
import { Schema, model } from "mongoose";

// Definir el esquema para los mensajes de chat
const chatMessageSchema = new Schema({
    // ID de la conversación para agrupar mensajes
    conversationId: {
        type: String,
        required: true,
        index: true
    },
    // ID del usuario que envía el mensaje
    senderId: {
        type: Schema.Types.ObjectId,
        required: true,
        refPath: 'senderType'
    },
    // Tipo de usuario que envía (admin o Customer)
    senderType: {
        type: String,
        required: true,
        enum: ['admin', 'Customer']
    },
    // Contenido del mensaje
    message: {
        type: String,
        required: true,
        maxLength: 1000
    },
    // Estado del mensaje (enviado, entregado, leído)
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read'],
        default: 'sent'
    },
    // Indica si el mensaje fue leído
    isRead: {
        type: Boolean,
        default: false
    },
    // Fecha de lectura del mensaje
    readAt: {
        type: Date,
        default: null
    }
}, {
    // Agregar automáticamente campos createdAt y updatedAt
    timestamps: true
});

// Definir el esquema para las conversaciones de chat
const chatConversationSchema = new Schema({
    // ID único de la conversación
    conversationId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    // ID del cliente participante
    clientId: {
        type: Schema.Types.ObjectId,
        ref: 'Clients',
        required: true
    },
    // Estado de la conversación
    status: {
        type: String,
        enum: ['active', 'closed'],
        default: 'active'
    },
    // Último mensaje de la conversación
    lastMessage: {
        type: String,
        default: ''
    },
    // Fecha del último mensaje
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    // Contador de mensajes no leídos por el admin
    unreadCountAdmin: {
        type: Number,
        default: 0
    },
    // Contador de mensajes no leídos por el cliente
    unreadCountClient: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Índices para optimizar consultas
chatMessageSchema.index({ conversationId: 1, createdAt: -1 });
chatMessageSchema.index({ senderId: 1, senderType: 1 });
chatConversationSchema.index({ clientId: 1 });
chatConversationSchema.index({ lastMessageAt: -1 });

// Exportar ambos modelos
export const ChatMessage = model("ChatMessage", chatMessageSchema);
export const ChatConversation = model("ChatConversation", chatConversationSchema);