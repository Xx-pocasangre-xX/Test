import ChatMessage from "../models/ChatMessage.js";
import ChatConversation from "../models/ChatConversation.js";
import clientsModel from "../models/Clients.js";
import { emitNewMessage, emitConversationClosed, emitMessagesRead, emitChatStats } from "../utils/socketConfig.js";

const chatController = {};

// Función para generar ID único de conversación
const generateConversationId = (clientId) => {
    return `chat_${clientId}_${Date.now()}`;
};

// Obtener o crear conversación
chatController.getOrCreateConversation = async (req, res) => {
    try {
        const { clientId } = req.params;
        
        // Validar usuario autenticado
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Usuario no autenticado"
            });
        }

        // Verificar permisos - los clientes solo pueden acceder a su propia conversación
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

        // Buscar conversación existente activa usando el método estático
        let conversation = await ChatConversation.findActiveByClient(clientId);

        // Si no existe, crear nueva conversación
        if (!conversation) {
            const conversationId = generateConversationId(clientId);
            conversation = new ChatConversation({
                conversationId,
                clientId: clientId
            });
            await conversation.save();
        }

        // Preparar respuesta con información del cliente
        const response = {
            ...conversation.toObject(),
            clientId: {
                _id: client._id,
                fullName: client.fullName,
                email: client.email
            }
        };

        res.status(200).json({
            success: true,
            conversation: response
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

// Enviar mensaje
chatController.sendMessage = async (req, res) => {
    try {
        const { conversationId, message } = req.body;
        
        // Validar usuario autenticado
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Usuario no autenticado"
            });
        }

        const { id: senderId, userType: senderType } = req.user;

        // Validar datos requeridos
        if (!conversationId || !message?.trim()) {
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

        // Verificar permisos - los clientes solo pueden enviar mensajes a su conversación
        if (senderType === 'Customer' && conversation.clientId !== senderId) {
            return res.status(403).json({
                success: false,
                message: "No tienes permisos para enviar mensajes a esta conversación"
            });
        }

        // Crear mensaje con el ID del remitente
        const messageSenderId = senderType === 'admin' ? 'admin' : senderId;

        const chatMessage = new ChatMessage({
            conversationId,
            senderId: messageSenderId,
            senderType,
            message: message.trim(),
            status: 'sent'
        });

        await chatMessage.save();

        // Actualizar la conversación con el último mensaje
        const updateData = {
            lastMessage: message.trim(),
            lastMessageAt: new Date(),
            status: 'active'
        };

        // Incrementar contador de mensajes no leídos según el tipo de usuario
        if (senderType === 'admin') {
            updateData.unreadCountClient = (conversation.unreadCountClient || 0) + 1;
        } else {
            updateData.unreadCountAdmin = (conversation.unreadCountAdmin || 0) + 1;
        }

        await ChatConversation.findOneAndUpdate(
            { conversationId },
            updateData
        );

        // Preparar respuesta del mensaje
        const responseMessage = {
            ...chatMessage.toObject(),
            senderId: {
                _id: messageSenderId,
                fullName: senderType === 'admin' ? 'Administrador' : 'Cliente',
                email: req.user.email || ''
            }
        };

        // ===== EMISIÓN EN TIEMPO REAL =====
        // Obtener instancia de Socket.IO
        const io = req.app.get('io');
        if (io) {
            // Emitir nuevo mensaje a todos los usuarios en la conversación
            emitNewMessage(io, conversationId, responseMessage);
            
            // Emitir estadísticas actualizadas a administradores
            emitChatStats(io);
        }

        res.status(201).json({
            success: true,
            message: responseMessage
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
        
        // Validar usuario autenticado
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Usuario no autenticado"
            });
        }

        const { id: userId, userType } = req.user;

        // Verificar que la conversación existe
        const conversation = await ChatConversation.findOne({ 
            conversationId: conversationId 
        }).lean();
        
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversación no encontrada"
            });
        }

        // Verificar permisos - los clientes solo pueden ver mensajes de su conversación
        if (userType === 'Customer' && conversation.clientId !== userId) {
            return res.status(403).json({
                success: false,
                message: "No tienes permisos para acceder a esta conversación"
            });
        }

        // Obtener mensajes con paginación
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const messages = await ChatMessage.find({ conversationId })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .lean();

        // Población manual de la información del remitente
        const populatedMessages = messages.map(message => ({
            ...message,
            senderId: {
                _id: message.senderId,
                fullName: message.senderType === 'admin' ? 'Administrador' : 'Cliente',
                email: ''
            }
        }));

        // Contar total de mensajes para paginación
        const totalMessages = await ChatMessage.countDocuments({ conversationId });

        res.status(200).json({
            success: true,
            messages: populatedMessages.reverse(), // Revertir para mostrar cronológicamente
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
        
        // Validar usuario autenticado
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Usuario no autenticado"
            });
        }

        const { id: userId, userType } = req.user;
        const queryUserId = userType === 'admin' ? 'admin' : userId;

        // Marcar mensajes como leídos (excepto los propios)
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

        // Resetear contador de mensajes no leídos en la conversación
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

        // ===== EMISIÓN EN TIEMPO REAL =====
        // Obtener instancia de Socket.IO
        const io = req.app.get('io');
        if (io) {
            // Emitir evento de mensajes leídos
            emitMessagesRead(io, conversationId, {
                userId: userId,
                userType: userType
            });
        }

        res.status(200).json({
            success: true,
            message: "Mensajes marcados como leídos"
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

// Obtener todas las conversaciones (solo administradores)
chatController.getAllConversations = async (req, res) => {
    try {
        // Validar que sea administrador
        if (!req.user || req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Acceso denegado"
            });
        }

        const { page = 1, limit = 20, status = 'all' } = req.query;
        
        // Construir filtro de búsqueda
        const filter = {};
        if (status !== 'all') {
            filter.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Obtener conversaciones ordenadas por último mensaje
        const conversations = await ChatConversation.find(filter)
            .sort({ lastMessageAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .lean();

        // Población manual de información del cliente para cada conversación
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

        // Contar total de conversaciones para paginación
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
        console.error('Error en getAllConversations:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor",
            error: error.message
        });
    }
};

// Cerrar conversación (solo administradores)
chatController.closeConversation = async (req, res) => {
    try {
        // Validar que sea administrador
        if (!req.user || req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Acceso denegado"
            });
        }

        const { conversationId } = req.params;

        // Buscar y actualizar la conversación usando el método de instancia
        const conversation = await ChatConversation.findOne({ conversationId });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversación no encontrada"
            });
        }

        // Usar el método de instancia para cerrar la conversación
        await conversation.close();

        // ===== EMISIÓN EN TIEMPO REAL =====
        // Obtener instancia de Socket.IO
        const io = req.app.get('io');
        if (io) {
            // Emitir evento de conversación cerrada
            emitConversationClosed(io, conversationId);
            
            // Emitir estadísticas actualizadas
            emitChatStats(io);
        }

        res.status(200).json({
            success: true,
            message: "Conversación cerrada exitosamente",
            conversation: conversation.toObject()
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

// Obtener estadísticas del chat (solo administradores)
chatController.getChatStats = async (req, res) => {
    try {
        // Validar que sea administrador
        if (!req.user || req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Acceso denegado"
            });
        }

        // Ejecutar consultas en paralelo para mejor rendimiento
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

export default chatController;