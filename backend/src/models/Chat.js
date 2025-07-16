import { Schema, model } from "mongoose";

// Esquema ultra simple para mensajes
const chatMessageSchema = new Schema({
    conversationId: {
        type: String,
        required: true,
        index: true
    },
    senderId: {
        type: String, // SOLO STRING, sin ObjectId
        required: true
    },
    senderType: {
        type: String,
        required: true,
        enum: ['admin', 'Customer']
    },
    message: {
        type: String,
        required: true,
        maxLength: 1000
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read'],
        default: 'sent'
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Esquema ultra simple para conversaciones
const chatConversationSchema = new Schema({
    conversationId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    clientId: {
        type: String, // SOLO STRING, sin ObjectId
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'closed'],
        default: 'active'
    },
    lastMessage: {
        type: String,
        default: ''
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    unreadCountAdmin: {
        type: Number,
        default: 0
    },
    unreadCountClient: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Índices básicos
chatMessageSchema.index({ conversationId: 1, createdAt: -1 });
chatConversationSchema.index({ clientId: 1 });

export const ChatMessage = model("ChatMessage", chatMessageSchema);
export const ChatConversation = model("ChatConversation", chatConversationSchema);