// Importa los hooks useState y useEffect desde React
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useSocket } from "./useSocket";

// Custom hook para manejar la funcionalidad de chat
export const useChat = () => {
    // Estados principales del chat
    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    
    // Estados para paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    
    // Estados adicionales para funcionalidades en tiempo real
    const [typingUsers, setTypingUsers] = useState(new Set());
    const typingTimeoutRef = useRef(null);
    
    // Referencias para controlar el comportamiento del chat
    const messagesEndRef = useRef(null);
    const pollingIntervalRef = useRef(null);
    const isInitializedRef = useRef(false);
    const lastMessageCountRef = useRef(0);
    const activeConversationRef = useRef(null);
    
    const { user, isAuthenticated } = useAuth();
    
    // Hook de Socket.IO para comunicación en tiempo real
    const {
        isConnected: socketConnected,
        joinConversation,
        leaveConversation,
        startTyping,
        stopTyping,
        onNewMessage,
        onConversationUpdated,
        onConversationClosed,
        onMessagesRead,
        onUserTyping,
        onChatStatsUpdated
    } = useSocket();

    // URL base de la API
    const API_BASE = "http://localhost:4000/api/chat";

    // Actualizar referencia cuando cambia la conversación activa
    useEffect(() => {
        activeConversationRef.current = activeConversation;
    }, [activeConversation]);

    // Función para realizar peticiones a la API
    const apiRequest = useCallback(async (url, options = {}) => {
        try {
            const response = await fetch(`${API_BASE}${url}`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `Error ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('Error en petición API:', error);
            throw error;
        }
    }, []);

    // Función para hacer scroll al final de los mensajes
    const scrollToBottom = useCallback(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, []);

    // Configurar eventos de Socket.IO cuando se inicializa
    useEffect(() => {
        if (!socketConnected || !isAuthenticated) return;

        // Configurar listeners de Socket.IO
        const unsubscribeNewMessage = onNewMessage((data) => {
            // Agregar nuevo mensaje recibido
            setMessages(prev => {
                // Verificar que no exista ya el mensaje
                const exists = prev.find(msg => msg._id === data.message._id);
                if (exists) return prev;
                
                // Agregar nuevo mensaje y hacer scroll
                setTimeout(() => scrollToBottom(), 100);
                return [...prev, data.message];
            });
            
            // Actualizar conversaciones si es admin
            if (user.userType === 'admin') {
                setConversations(prev => prev.map(conv => 
                    conv.conversationId === data.conversationId
                        ? { 
                            ...conv, 
                            lastMessage: data.message.message,
                            lastMessageAt: data.timestamp,
                            unreadCountAdmin: data.message.senderType !== 'admin' 
                                ? (conv.unreadCountAdmin || 0) + 1 
                                : conv.unreadCountAdmin
                        }
                        : conv
                ));
            }
        });

        const unsubscribeConversationUpdated = onConversationUpdated((data) => {
            if (user.userType === 'admin') {
                setConversations(prev => prev.map(conv => 
                    conv.conversationId === data.conversationId
                        ? { ...conv, ...data }
                        : conv
                ));
            }
        });

        const unsubscribeConversationClosed = onConversationClosed((data) => {
            // Actualizar estado de la conversación
            setConversations(prev => prev.map(conv => 
                conv.conversationId === data.conversationId
                    ? { ...conv, status: 'closed' }
                    : conv
            ));
            
            // Si es la conversación activa, mostrar notificación
            if (activeConversationRef.current?.conversationId === data.conversationId) {
                setError('La conversación ha sido cerrada por el administrador');
            }
        });

        const unsubscribeMessagesRead = onMessagesRead((data) => {
            // Marcar mensajes como leídos en el estado local
            setMessages(prev => prev.map(msg => ({
                ...msg,
                isRead: true,
                readAt: data.timestamp
            })));
            
            // Actualizar contadores de no leídos
            if (user.userType === 'admin') {
                setConversations(prev => prev.map(conv => 
                    conv.conversationId === data.conversationId
                        ? { ...conv, unreadCountAdmin: 0 }
                        : conv
                ));
            }
        });

        const unsubscribeUserTyping = onUserTyping((data) => {
            if (data.userId !== user.id) {
                setTypingUsers(prev => {
                    const newSet = new Set(prev);
                    if (data.isTyping) {
                        newSet.add(data.userId);
                    } else {
                        newSet.delete(data.userId);
                    }
                    return newSet;
                });
            }
        });

        const unsubscribeChatStats = onChatStatsUpdated((stats) => {
            if (user.userType === 'admin') {
                setUnreadCount(stats.unreadMessages || 0);
            }
        });

        // Cleanup function
        return () => {
            unsubscribeNewMessage?.();
            unsubscribeConversationUpdated?.();
            unsubscribeConversationClosed?.();
            unsubscribeMessagesRead?.();
            unsubscribeUserTyping?.();
            unsubscribeChatStats?.();
        };
    }, [socketConnected, isAuthenticated, user?.id, user?.userType, onNewMessage, onConversationUpdated, onConversationClosed, onMessagesRead, onUserTyping, onChatStatsUpdated, scrollToBottom]);

    // Obtener o crear conversación para el cliente actual
    const getOrCreateConversation = useCallback(async (showLoader = true) => {
        if (!user?.id || user.userType !== 'Customer') {
            return null;
        }
        
        try {
            if (showLoader) setLoading(true);
            const data = await apiRequest(`/conversation/${user.id}`);
            return data.conversation;
        } catch (error) {
            setError('Error al obtener conversación');
            return null;
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [user, apiRequest]);

    // Obtener todas las conversaciones (para administradores)
    const getAllConversations = useCallback(async (showLoader = true) => {
        if (!user || user.userType !== 'admin') {
            return;
        }
        
        try {
            if (showLoader) setLoading(true);
            const data = await apiRequest('/admin/conversations');
            
            // Solo actualizar si hay cambios significativos
            setConversations(prevConversations => {
                const newConversations = data.conversations || [];
                
                // Comparar cambios básicos
                const hasChanges = JSON.stringify(prevConversations.map(c => ({
                    id: c.conversationId,
                    lastMessage: c.lastMessage,
                    lastMessageAt: c.lastMessageAt,
                    unreadCount: c.unreadCountAdmin
                }))) !== JSON.stringify(newConversations.map(c => ({
                    id: c.conversationId,
                    lastMessage: c.lastMessage,
                    lastMessageAt: c.lastMessageAt,
                    unreadCount: c.unreadCountAdmin
                })));
                
                if (!hasChanges) {
                    return prevConversations;
                }
                
                return newConversations;
            });
            
            // Calcular mensajes no leídos para administradores
            const totalUnread = (data.conversations || []).reduce((sum, conv) => 
                sum + (conv.unreadCountAdmin || 0), 0);
            setUnreadCount(totalUnread);
            
        } catch (error) {
            setError('Error al obtener conversaciones');
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [user, apiRequest]);

    // Obtener mensajes de una conversación específica
    const getMessages = useCallback(async (conversationId, page = 1, resetMessages = false, showLoader = true) => {
        if (!conversationId) {
            return;
        }
        
        try {
            if (showLoader) setLoadingMessages(true);
            const data = await apiRequest(`/messages/${conversationId}?page=${page}&limit=50`);
            
            const newMessages = data.messages || [];
            
            if (resetMessages || page === 1) {
                // Verificar si hay cambios antes de actualizar
                setMessages(prevMessages => {
                    const hasSameIds = JSON.stringify(prevMessages.map(m => m._id)) === 
                                     JSON.stringify(newMessages.map(m => m._id));
                    
                    if (hasSameIds && prevMessages.length === newMessages.length) {
                        return prevMessages;
                    }
                    
                    lastMessageCountRef.current = newMessages.length;
                    return newMessages;
                });
                setCurrentPage(1);
            } else {
                // Cargar más mensajes (paginación)
                setMessages(prev => [...newMessages, ...prev]);
            }
            
            setHasMoreMessages(data.pagination?.hasNextPage || false);
            setCurrentPage(page);
            
            // Hacer scroll al final si hay mensajes nuevos
            if ((resetMessages || page === 1) && newMessages.length > lastMessageCountRef.current) {
                setTimeout(() => scrollToBottom(), 100);
            }
            
        } catch (error) {
            setError('Error al obtener mensajes');
        } finally {
            if (showLoader) setLoadingMessages(false);
        }
    }, [apiRequest]);

    // Manejar cambios en el input para indicar que está escribiendo
    const handleMessageChange = useCallback((value) => {
        setNewMessage(value);
        
        if (!activeConversationRef.current) return;
        
        // Iniciar indicador de escritura
        if (value.trim() && !typingTimeoutRef.current) {
            startTyping(activeConversationRef.current.conversationId);
        }
        
        // Limpiar timeout anterior
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        
        // Parar indicador de escritura después de 2 segundos sin escribir
        typingTimeoutRef.current = setTimeout(() => {
            stopTyping(activeConversationRef.current?.conversationId);
            typingTimeoutRef.current = null;
        }, 2000);
        
        // Si no hay texto, parar inmediatamente
        if (!value.trim()) {
            stopTyping(activeConversationRef.current.conversationId);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
        }
    }, [startTyping, stopTyping]);

    // Enviar un mensaje (ya no necesita polling, Socket.IO maneja tiempo real)
    const sendMessage = useCallback(async (conversationId, message) => {
        if (!conversationId || !message.trim()) {
            return false;
        }
        
        // Parar indicador de escritura antes de enviar
        stopTyping(conversationId);
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
        
        try {
            const data = await apiRequest('/message', {
                method: 'POST',
                body: JSON.stringify({
                    conversationId,
                    message: message.trim()
                })
            });
            
            // El mensaje se agregará automáticamente via Socket.IO
            // Solo actualizamos conversaciones si es admin
            if (user.userType === 'admin') {
                setConversations(prev => prev.map(conv => 
                    conv.conversationId === conversationId 
                        ? { ...conv, lastMessage: message.trim(), lastMessageAt: new Date() }
                        : conv
                ));
            }
            
            return true;
        } catch (error) {
            setError('Error al enviar mensaje');
            return false;
        }
    }, [user, apiRequest, stopTyping]);

    // Marcar mensajes como leídos
    const markAsRead = useCallback(async (conversationId) => {
        if (!conversationId) return;
        
        try {
            await apiRequest(`/read/${conversationId}`, { method: 'PUT' });
            
            // Actualizar estado local para administradores
            if (user.userType === 'admin') {
                setConversations(prev => prev.map(conv => 
                    conv.conversationId === conversationId 
                        ? { ...conv, unreadCountAdmin: 0 }
                        : conv
                ));
                
                // Recalcular total de no leídos
                setUnreadCount(prev => Math.max(0, prev - (activeConversationRef.current?.unreadCountAdmin || 0)));
            }
            
        } catch (error) {
            console.error('Error marcando como leído:', error);
        }
    }, [user, apiRequest]);

    // Cerrar conversación (solo administradores)
    const closeConversation = useCallback(async (conversationId) => {
        if (!conversationId || user.userType !== 'admin') return false;
        
        try {
            await apiRequest(`/admin/close/${conversationId}`, { method: 'PUT' });
            
            // Actualizar estado local
            setConversations(prev => prev.map(conv => 
                conv.conversationId === conversationId 
                    ? { ...conv, status: 'closed' }
                    : conv
            ));
            
            return true;
        } catch (error) {
            setError('Error al cerrar conversación');
            return false;
        }
    }, [user, apiRequest]);

    // Seleccionar conversación activa y unirse a la sala de Socket.IO
    const selectConversation = useCallback(async (conversation) => {
        if (!conversation) return;
        
        // Salir de la conversación anterior si existe
        if (activeConversationRef.current) {
            leaveConversation(activeConversationRef.current.conversationId);
        }
        
        setActiveConversation(conversation);
        setMessages([]);
        setCurrentPage(1);
        setHasMoreMessages(true);
        lastMessageCountRef.current = 0;
        setTypingUsers(new Set());
        
        // Unirse a la nueva conversación en Socket.IO
        joinConversation(conversation.conversationId);
        
        await getMessages(conversation.conversationId, 1, true, true);
        await markAsRead(conversation.conversationId);
    }, [getMessages, markAsRead, leaveConversation, joinConversation]);

    // Cargar más mensajes (paginación)
    const loadMoreMessages = useCallback(async () => {
        if (!activeConversation || !hasMoreMessages || loadingMessages) return;
        
        const nextPage = currentPage + 1;
        await getMessages(activeConversation.conversationId, nextPage, false, true);
    }, [activeConversation, hasMoreMessages, loadingMessages, currentPage, getMessages]);

    // Reducir frecuencia de polling ya que Socket.IO maneja tiempo real
    const checkForNewMessages = useCallback(async () => {
        try {
            // Solo verificar conversaciones para admin cada 30 segundos (como backup)
            if (user.userType === 'admin') {
                await getAllConversations(false);
            }
        } catch (error) {
            // Error silencioso para backup polling
        }
    }, [user, getAllConversations]);

    // Iniciar polling reducido (backup para Socket.IO)
    const startPolling = useCallback(() => {
        if (pollingIntervalRef.current) return;
        
        // Polling cada 30 segundos como backup (Socket.IO es primario)
        pollingIntervalRef.current = setInterval(checkForNewMessages, 30000);
    }, [checkForNewMessages]);

    // Detener polling
    const stopPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    }, []);

    // Inicializar chat según tipo de usuario
    const initializeChat = useCallback(async () => {
        if (!isAuthenticated || !user || isInitializedRef.current) {
            return;
        }
        
        isInitializedRef.current = true;
        setIsConnected(true);
        
        try {
            if (user.userType === 'admin') {
                // Inicializar chat para administrador
                await getAllConversations(true);
            } else if (user.userType === 'Customer') {
                // Inicializar chat para cliente
                const conversation = await getOrCreateConversation(true);
                if (conversation) {
                    await selectConversation(conversation);
                }
            }
            
            startPolling();
        } catch (error) {
            setError('Error al inicializar el chat');
            isInitializedRef.current = false;
        }
    }, [isAuthenticated, user, getAllConversations, getOrCreateConversation, selectConversation, startPolling]);

    // Limpiar recursos del chat
    const cleanup = useCallback(() => {
        stopPolling();
        
        // Salir de conversación activa
        if (activeConversationRef.current) {
            leaveConversation(activeConversationRef.current.conversationId);
        }
        
        // Limpiar timeout de escritura
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
        
        setConversations([]);
        setActiveConversation(null);
        setMessages([]);
        setNewMessage('');
        setIsConnected(false);
        setError(null);
        setTypingUsers(new Set());
        isInitializedRef.current = false;
        lastMessageCountRef.current = 0;
    }, [stopPolling, leaveConversation]);

    // Effect principal para inicializar y limpiar
    useEffect(() => {
        if (isAuthenticated && user && !isInitializedRef.current) {
            initializeChat();
        } else if (!isAuthenticated || !user) {
            cleanup();
        }
        
        return () => {
            if (!isAuthenticated || !user) {
                cleanup();
            }
        };
    }, [isAuthenticated, user?.id, user?.userType]);

    // Cleanup al desmontar el componente
    useEffect(() => {
        return cleanup;
    }, []);

    // Función para limpiar errores
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Función para refrescar manualmente
    const refresh = useCallback(async () => {
        if (!isAuthenticated || !user) return;
        
        try {
            if (user.userType === 'admin') {
                await getAllConversations(true);
            }
            
            if (activeConversation) {
                await getMessages(activeConversation.conversationId, 1, true, true);
            }
        } catch (error) {
            setError('Error refrescando chat');
        }
    }, [isAuthenticated, user, getAllConversations, getMessages, activeConversation]);

    return {
        // Estados
        conversations,
        activeConversation,
        messages,
        newMessage,
        loading,
        error,
        isConnected: isConnected && socketConnected,
        unreadCount,
        hasMoreMessages,
        loadingMessages,
        typingUsers,
        
        // Setters actualizados
        setNewMessage: handleMessageChange,
        
        // Acciones
        sendMessage,
        selectConversation,
        markAsRead,
        closeConversation,
        loadMoreMessages,
        scrollToBottom,
        clearError,
        refresh,
        
        // Referencias
        messagesEndRef
    };
};