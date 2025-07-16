// Importar los modelos de chat y clientes
import { ChatMessage, ChatConversation } from "../models/Chat.js";
import clientsModel from "../models/Clients.js";

// Objeto que contendrá todas las funciones del controller
const chatController = {};

// Función para generar ID único de conversación
const generateConversationId = (clientId) => {
    return `chat_${clientId}_${Date.now()}`;
};

// Obtener o crear una conversación para un cliente
chatController.getOrCreateConversation = async (req, res) => {
    try {
        const { clientId } = req.params;
        
        // Verificar que el cliente existe
        const client = await clientsModel.findById(clientId);
        if (!client) {
            return res.status(404).json({
                success: false,
                message: "Cliente no encontrado"
            });
        }

        // Buscar conversación activa existente
        let conversation = await ChatConversation.findOne({ 
            clientId: clientId,
            status: 'active'
        }).populate('clientId', 'fullName email');

        // Si no existe, crear nueva conversación
        if (!conversation) {
            const conversationId = generateConversationId(clientId);
            conversation = new ChatConversation({
                conversationId,
                clientId: clientId
            });
            await conversation.save();
            await conversation.populate('clientId', 'fullName email');
        }

        res.status(200).json({
            success: true,
            conversation
        });
    } catch (error) {
        console.error('Error en getOrCreateConversation:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Enviar un mensaje
chatController.sendMessage = async (req, res) => {
    try {
        const { conversationId, message } = req.body;
        const { id: senderId, userType: senderType } = req.user;

        // Validar datos requeridos
        if (!conversationId || !message || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Conversación y mensaje son requeridos"
            });
        }

        // Verificar que la conversación existe
        const conversation = await ChatConversation.findOne({ 
            conversationId: conversationId 
        });
        
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversación no encontrada"
            });
        }

        // Verificar permisos: el cliente solo puede enviar a su propia conversación
        if (senderType === 'Customer' && conversation.clientId.toString() !== senderId) {
            return res.status(403).json({
                success: false,
                message: "No tienes permisos para enviar mensajes a esta conversación"
            });
        }

        // Crear el mensaje
        const chatMessage = new ChatMessage({
            conversationId,
            senderId,
            senderType,
            message: message.trim(),
            status: 'sent'
        });

        await chatMessage.save();

        // Actualizar la conversación
        const updateData = {
            lastMessage: message.trim(),
            lastMessageAt: new Date(),
            status: 'active'
        };

        // Incrementar contador de no leídos según quien envía
        if (senderType === 'admin') {
            updateData.unreadCountClient = conversation.unreadCountClient + 1;
        } else {
            updateData.unreadCountAdmin = conversation.unreadCountAdmin + 1;
        }

        await ChatConversation.findOneAndUpdate(
            { conversationId },
            updateData
        );

        // Poblar información del remitente
        await chatMessage.populate('senderId', 'fullName email');

        res.status(201).json({
            success: true,
            message: chatMessage
        });
    } catch (error) {
        console.error('Error en sendMessage:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Obtener mensajes de una conversación
chatController.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        const { id: userId, userType } = req.user;

        // Verificar que la conversación existe
        const conversation = await ChatConversation.findOne({ 
            conversationId: conversationId 
        });
        
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversación no encontrada"
            });
        }

        // Verificar permisos
        if (userType === 'Customer' && conversation.clientId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "No tienes permisos para acceder a esta conversación"
            });
        }

        // Calcular skip para paginación
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Obtener mensajes con paginación
        const messages = await ChatMessage.find({ conversationId })
            .populate('senderId', 'fullName email')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        // Contar total de mensajes
        const totalMessages = await ChatMessage.countDocuments({ conversationId });

        res.status(200).json({
            success: true,
            messages: messages.reverse(), // Invertir para mostrar cronológicamente
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalMessages / parseInt(limit)),
                totalMessages,
                hasNextPage: skip + messages.length < totalMessages,
                hasPrevPage: parseInt(page) > 1
            }
        });
    } catch (error) {
        console.error('Error en getMessages:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Marcar mensajes como leídos
chatController.markAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { id: userId, userType } = req.user;

        // Verificar que la conversación existe
        const conversation = await ChatConversation.findOne({ 
            conversationId: conversationId 
        });
        
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversación no encontrada"
            });
        }

        // Verificar permisos
        if (userType === 'Customer' && conversation.clientId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "No tienes permisos para acceder a esta conversación"
            });
        }

        // Marcar mensajes como leídos (mensajes que NO envió el usuario actual)
        const updateResult = await ChatMessage.updateMany(
            { 
                conversationId,
                senderId: { $ne: userId },
                isRead: false
            },
            { 
                isRead: true,
                readAt: new Date()
            }
        );

        // Resetear contador de no leídos en la conversación
        const conversationUpdate = {};
        if (userType === 'admin') {
            conversationUpdate.unreadCountAdmin = 0;
        } else {
            conversationUpdate.unreadCountClient = 0;
        }

        await ChatConversation.findOneAndUpdate(
            { conversationId },
            conversationUpdate
        );

        res.status(200).json({
            success: true,
            message: "Mensajes marcados como leídos",
            messagesUpdated: updateResult.modifiedCount
        });
    } catch (error) {
        console.error('Error en markAsRead:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Obtener todas las conversaciones (para admin)
chatController.getAllConversations = async (req, res) => {
    try {
        const { page = 1, limit = 20, status = 'all' } = req.query;
        
        // Construir filtro
        const filter = {};
        if (status !== 'all') {
            filter.status = status;
        }

        // Calcular skip para paginación
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Obtener conversaciones con información del cliente
        const conversations = await ChatConversation.find(filter)
            .populate('clientId', 'fullName email profilePicture')
            .sort({ lastMessageAt: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        // Contar total de conversaciones
        const totalConversations = await ChatConversation.countDocuments(filter);

        res.status(200).json({
            success: true,
            conversations,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalConversations / parseInt(limit)),
                totalConversations,
                hasNextPage: skip + conversations.length < totalConversations,
                hasPrevPage: parseInt(page) > 1
            }
        });
    } catch (error) {
        console.error('Error en getAllConversations:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Cerrar conversación
chatController.closeConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;

        const conversation = await ChatConversation.findOneAndUpdate(
            { conversationId },
            { status: 'closed' },
            { new: true }
        ).populate('clientId', 'fullName email');

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversación no encontrada"
            });
        }

        res.status(200).json({
            success: true,
            message: "Conversación cerrada exitosamente",
            conversation
        });
    } catch (error) {
        console.error('Error en closeConversation:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Obtener estadísticas de chat para admin
chatController.getChatStats = async (req, res) => {
    try {
        const [
            totalConversations,
            activeConversations,
            totalMessages,
            unreadMessages
        ] = await Promise.all([
            ChatConversation.countDocuments(),
            ChatConversation.countDocuments({ status: 'active' }),
            ChatMessage.countDocuments(),
            ChatConversation.aggregate([
                { $group: { _id: null, total: { $sum: '$unreadCountAdmin' } } }
            ])
        ]);

        const unreadCount = unreadMessages.length > 0 ? unreadMessages[0].total : 0;

        res.status(200).json({
            success: true,
            stats: {
                totalConversations,
                activeConversations,
                closedConversations: totalConversations - activeConversations,
                totalMessages,
                unreadMessages: unreadCount
            }
        });
    } catch (error) {
        console.error('Error en getChatStats:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Exportar el controller
export default chatController;