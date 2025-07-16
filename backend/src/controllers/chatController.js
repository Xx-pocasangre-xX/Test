import { ChatMessage, ChatConversation } from "../models/Chat.js";
import clientsModel from "../models/Clients.js";

const chatController = {};

const debugLog = (message, data = null) => {
    console.log(`🔥 CHAT: ${message}`, data || '');
};

const generateConversationId = (clientId) => {
    return `chat_${clientId}_${Date.now()}`;
};

// Obtener o crear conversación
chatController.getOrCreateConversation = async (req, res) => {
    debugLog('getOrCreateConversation iniciado');
    
    try {
        const { clientId } = req.params;
        
        if (!req.user) {
            debugLog('❌ No hay usuario autenticado');
            return res.status(401).json({
                success: false,
                message: "Usuario no autenticado"
            });
        }

        debugLog('Usuario autenticado:', req.user);
        debugLog('ClientId recibido:', clientId);

        // Verificar permisos
        if (req.user.userType === 'Customer' && req.user.id !== clientId) {
            return res.status(403).json({
                success: false,
                message: "No tienes permisos para acceder a esta conversación"
            });
        }
        
        // Verificar que el cliente existe
        const client = await clientsModel.findById(clientId).lean();
        if (!client) {
            return res.status(404).json({
                success: false,
                message: "Cliente no encontrado"
            });
        }

        debugLog('Cliente encontrado:', client.fullName);

        // Buscar conversación existente (con clientId como string)
        let conversation = await ChatConversation.findOne({ 
            clientId: clientId, // String directo
            status: 'active'
        }).lean();

        // Si no existe, crear nueva
        if (!conversation) {
            const conversationId = generateConversationId(clientId);
            conversation = new ChatConversation({
                conversationId,
                clientId: clientId // String directo
            });
            await conversation.save();
            conversation = conversation.toObject();
            debugLog('Conversación creada:', conversationId);
        }

        // Respuesta simple
        const response = {
            ...conversation,
            clientId: {
                _id: client._id,
                fullName: client.fullName,
                email: client.email
            }
        };

        debugLog('Respondiendo con conversación');
        res.status(200).json({
            success: true,
            conversation: response
        });

    } catch (error) {
        debugLog('❌ Error:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Enviar mensaje
chatController.sendMessage = async (req, res) => {
    debugLog('sendMessage iniciado');
    
    try {
        const { conversationId, message } = req.body;
        
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Usuario no autenticado"
            });
        }

        const { id: senderId, userType: senderType } = req.user;

        if (!conversationId || !message?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Conversación y mensaje son requeridos"
            });
        }

        // Verificar conversación
        const conversation = await ChatConversation.findOne({ 
            conversationId: conversationId 
        }).lean();
        
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversación no encontrada"
            });
        }

        // Verificar permisos
        if (senderType === 'Customer' && conversation.clientId !== senderId) {
            return res.status(403).json({
                success: false,
                message: "No tienes permisos para enviar mensajes a esta conversación"
            });
        }

        // Crear mensaje con senderId como string
        const messageSenderId = senderType === 'admin' ? 'admin' : senderId;

        const chatMessage = new ChatMessage({
            conversationId,
            senderId: messageSenderId, // String directo
            senderType,
            message: message.trim(),
            status: 'sent'
        });

        await chatMessage.save();

        // Actualizar conversación
        const updateData = {
            lastMessage: message.trim(),
            lastMessageAt: new Date(),
            status: 'active'
        };

        if (senderType === 'admin') {
            updateData.unreadCountClient = (conversation.unreadCountClient || 0) + 1;
        } else {
            updateData.unreadCountAdmin = (conversation.unreadCountAdmin || 0) + 1;
        }

        await ChatConversation.findOneAndUpdate(
            { conversationId },
            updateData
        );

        // Respuesta simple
        const responseMessage = {
            ...chatMessage.toObject(),
            senderId: {
                _id: messageSenderId,
                fullName: senderType === 'admin' ? 'Administrador' : 'Cliente',
                email: req.user.email || ''
            }
        };

        res.status(201).json({
            success: true,
            message: responseMessage
        });

    } catch (error) {
        debugLog('❌ Error en sendMessage:', error.message);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Obtener mensajes
chatController.getMessages = async (req, res) => {
    debugLog('getMessages iniciado');
    
    try {
        const { conversationId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Usuario no autenticado"
            });
        }

        const { id: userId, userType } = req.user;

        // Verificar conversación
        const conversation = await ChatConversation.findOne({ 
            conversationId: conversationId 
        }).lean();
        
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversación no encontrada"
            });
        }

        // Verificar permisos
        if (userType === 'Customer' && conversation.clientId !== userId) {
            return res.status(403).json({
                success: false,
                message: "No tienes permisos para acceder a esta conversación"
            });
        }

        // Obtener mensajes
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const messages = await ChatMessage.find({ conversationId })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .lean();

        debugLog(`Mensajes encontrados: ${messages.length}`);

        // Población manual simple
        const populatedMessages = messages.map(message => ({
            ...message,
            senderId: {
                _id: message.senderId,
                fullName: message.senderType === 'admin' ? 'Administrador' : 'Cliente',
                email: ''
            }
        }));

        const totalMessages = await ChatMessage.countDocuments({ conversationId });

        res.status(200).json({
            success: true,
            messages: populatedMessages.reverse(),
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalMessages / parseInt(limit)),
                totalMessages,
                hasNextPage: skip + messages.length < totalMessages,
                hasPrevPage: parseInt(page) > 1
            }
        });

    } catch (error) {
        debugLog('❌ Error en getMessages:', error.message);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Marcar como leído
chatController.markAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Usuario no autenticado"
            });
        }

        const { id: userId, userType } = req.user;
        const queryUserId = userType === 'admin' ? 'admin' : userId;

        await ChatMessage.updateMany(
            { 
                conversationId,
                senderId: { $ne: queryUserId },
                isRead: false
            },
            { 
                isRead: true,
                readAt: new Date()
            }
        );

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
            message: "Mensajes marcados como leídos"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Obtener todas las conversaciones (admin)
chatController.getAllConversations = async (req, res) => {
    debugLog('getAllConversations iniciado');
    
    try {
        if (!req.user || req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Acceso denegado"
            });
        }

        const { page = 1, limit = 20, status = 'all' } = req.query;
        
        const filter = {};
        if (status !== 'all') {
            filter.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const conversations = await ChatConversation.find(filter)
            .sort({ lastMessageAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .lean();

        debugLog(`Conversaciones encontradas: ${conversations.length}`);

        // Población manual de clientes
        const populatedConversations = await Promise.all(
            conversations.map(async (conv) => {
                try {
                    const client = await clientsModel.findById(conv.clientId, 'fullName email profilePicture').lean();
                    return {
                        ...conv,
                        clientId: client || { 
                            _id: conv.clientId, 
                            fullName: 'Cliente desconocido', 
                            email: '',
                            profilePicture: null
                        }
                    };
                } catch (error) {
                    return {
                        ...conv,
                        clientId: { 
                            _id: conv.clientId, 
                            fullName: 'Cliente con error', 
                            email: '',
                            profilePicture: null
                        }
                    };
                }
            })
        );

        const totalConversations = await ChatConversation.countDocuments(filter);

        res.status(200).json({
            success: true,
            conversations: populatedConversations,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalConversations / parseInt(limit)),
                totalConversations,
                hasNextPage: skip + conversations.length < totalConversations,
                hasPrevPage: parseInt(page) > 1
            }
        });

    } catch (error) {
        debugLog('❌ Error en getAllConversations:', error.message);
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
        if (!req.user || req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Acceso denegado"
            });
        }

        const { conversationId } = req.params;

        const conversation = await ChatConversation.findOneAndUpdate(
            { conversationId },
            { status: 'closed' },
            { new: true }
        ).lean();

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
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Obtener estadísticas
chatController.getChatStats = async (req, res) => {
    try {
        if (!req.user || req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Acceso denegado"
            });
        }

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
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

export default chatController;