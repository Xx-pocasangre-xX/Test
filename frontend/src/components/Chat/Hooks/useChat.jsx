// Importa los hooks useState y useEffect desde React
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../../context/AuthContext";

// Custom hook para manejar la funcionalidad de chat
export const useChat = () => {
    // Estados del chat
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
    
    // Refs para controlar el scroll y polling
    const messagesEndRef = useRef(null);
    const pollingIntervalRef = useRef(null);
    const isInitializedRef = useRef(false);
    const lastMessageCountRef = useRef(0);
    const activeConversationRef = useRef(null);
    
    const { user, isAuthenticated } = useAuth();

    // URLs base de la API
    const API_BASE = "http://localhost:4000/api/chat";

    // Debug function
    const debugLog = (message, data = null) => {
        console.log(`🔥 FRONTEND CHAT DEBUG: ${message}`, data || '');
    };

    // Actualizar ref cuando cambia activeConversation
    useEffect(() => {
        activeConversationRef.current = activeConversation;
    }, [activeConversation]);

    // Función para hacer peticiones a la API con manejo de errores MEJORADO
    const apiRequest = useCallback(async (url, options = {}) => {
        debugLog(`Haciendo petición a: ${API_BASE}${url}`);
        debugLog('Opciones de petición:', options);
        
        try {
            const response = await fetch(`${API_BASE}${url}`, {
                credentials: 'include', // ¡MUY IMPORTANTE!
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            debugLog(`Respuesta recibida - Status: ${response.status}`);

            const data = await response.json();
            debugLog('Data recibida:', data);
            
            if (!response.ok) {
                throw new Error(data.message || `Error ${response.status}`);
            }
            
            return data;
        } catch (error) {
            debugLog('❌ Error en petición:', error.message);
            console.error('Error completo en API request:', error);
            throw error;
        }
    }, []);

    // Obtener o crear conversación para el cliente actual
    const getOrCreateConversation = useCallback(async (showLoader = true) => {
        if (!user?.id || user.userType !== 'Customer') {
            debugLog('❌ Usuario no válido para crear conversación');
            return null;
        }
        
        debugLog('Obteniendo conversación para cliente:', user.id);
        
        try {
            if (showLoader) setLoading(true);
            const data = await apiRequest(`/conversation/${user.id}`);
            debugLog('✅ Conversación obtenida:', data.conversation);
            return data.conversation;
        } catch (error) {
            debugLog('❌ Error obteniendo conversación:', error.message);
            setError('Error al obtener conversación');
            return null;
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [user, apiRequest]);

    // Obtener todas las conversaciones (para admin) - CON CONTROL DE CAMBIOS
    const getAllConversations = useCallback(async (showLoader = true) => {
        if (!user || user.userType !== 'admin') {
            debugLog('❌ Usuario no es admin, saltando getAllConversations');
            return;
        }
        
        debugLog('Obteniendo todas las conversaciones (admin)');
        
        try {
            if (showLoader) setLoading(true);
            const data = await apiRequest('/admin/conversations');
            
            debugLog(`✅ ${data.conversations?.length || 0} conversaciones obtenidas`);
            
            // Solo actualizar si hay cambios reales
            setConversations(prevConversations => {
                const newConversations = data.conversations || [];
                
                // Comparar si hay cambios significativos
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
                    debugLog('📋 Sin cambios en conversaciones, manteniendo estado');
                    return prevConversations;
                }
                
                debugLog('🔄 Actualizando conversaciones por cambios detectados');
                return newConversations;
            });
            
            // Calcular mensajes no leídos
            const totalUnread = (data.conversations || []).reduce((sum, conv) => 
                sum + (conv.unreadCountAdmin || 0), 0);
            setUnreadCount(totalUnread);
            
        } catch (error) {
            debugLog('❌ Error obteniendo conversaciones:', error.message);
            setError('Error al obtener conversaciones');
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [user, apiRequest]);

    // Obtener mensajes de una conversación específica - CON CONTROL DE CAMBIOS
    const getMessages = useCallback(async (conversationId, page = 1, resetMessages = false, showLoader = true) => {
        if (!conversationId) {
            debugLog('❌ No hay conversationId para obtener mensajes');
            return;
        }
        
        debugLog(`Obteniendo mensajes - Conversación: ${conversationId}, Página: ${page}`);
        
        try {
            if (showLoader) setLoadingMessages(true);
            const data = await apiRequest(`/messages/${conversationId}?page=${page}&limit=50`);
            
            const newMessages = data.messages || [];
            debugLog(`✅ ${newMessages.length} mensajes obtenidos`);
            
            if (resetMessages || page === 1) {
                // Solo actualizar si hay cambios en los mensajes
                setMessages(prevMessages => {
                    const hasSameIds = JSON.stringify(prevMessages.map(m => m._id)) === 
                                     JSON.stringify(newMessages.map(m => m._id));
                    
                    if (hasSameIds && prevMessages.length === newMessages.length) {
                        debugLog('📋 Sin cambios en mensajes, manteniendo estado');
                        return prevMessages;
                    }
                    
                    debugLog('🔄 Actualizando mensajes por cambios detectados');
                    lastMessageCountRef.current = newMessages.length;
                    return newMessages;
                });
                setCurrentPage(1);
            } else {
                setMessages(prev => [...newMessages, ...prev]);
            }
            
            setHasMoreMessages(data.pagination?.hasNextPage || false);
            setCurrentPage(page);
            
            // Auto-scroll al final solo si hay mensajes nuevos
            if ((resetMessages || page === 1) && newMessages.length > lastMessageCountRef.current) {
                setTimeout(() => scrollToBottom(), 100);
            }
            
        } catch (error) {
            debugLog('❌ Error obteniendo mensajes:', error.message);
            setError('Error al obtener mensajes');
        } finally {
            if (showLoader) setLoadingMessages(false);
        }
    }, [apiRequest]);

    // Función para hacer scroll al final
    const scrollToBottom = useCallback(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, []);

    // Enviar un mensaje
    const sendMessage = useCallback(async (conversationId, message) => {
        if (!conversationId || !message.trim()) {
            debugLog('❌ Datos inválidos para enviar mensaje');
            return false;
        }
        
        debugLog(`Enviando mensaje a conversación: ${conversationId}`);
        
        try {
            const data = await apiRequest('/message', {
                method: 'POST',
                body: JSON.stringify({
                    conversationId,
                    message: message.trim()
                })
            });
            
            debugLog('✅ Mensaje enviado correctamente');
            
            // Agregar el mensaje a la lista local
            setMessages(prev => [...prev, data.message]);
            
            // Actualizar última conversación si es admin
            if (user.userType === 'admin') {
                setConversations(prev => prev.map(conv => 
                    conv.conversationId === conversationId 
                        ? { ...conv, lastMessage: message.trim(), lastMessageAt: new Date() }
                        : conv
                ));
            }
            
            setTimeout(() => scrollToBottom(), 100);
            return true;
        } catch (error) {
            debugLog('❌ Error enviando mensaje:', error.message);
            setError('Error al enviar mensaje');
            return false;
        }
    }, [user, apiRequest, scrollToBottom]);

    // Marcar mensajes como leídos
    const markAsRead = useCallback(async (conversationId) => {
        if (!conversationId) return;
        
        debugLog(`Marcando mensajes como leídos: ${conversationId}`);
        
        try {
            await apiRequest(`/read/${conversationId}`, { method: 'PUT' });
            
            // Actualizar estado local
            if (user.userType === 'admin') {
                setConversations(prev => prev.map(conv => 
                    conv.conversationId === conversationId 
                        ? { ...conv, unreadCountAdmin: 0 }
                        : conv
                ));
                
                // Recalcular total de no leídos
                setUnreadCount(prev => Math.max(0, prev - (activeConversationRef.current?.unreadCountAdmin || 0)));
            }
            
            debugLog('✅ Mensajes marcados como leídos');
        } catch (error) {
            debugLog('❌ Error marcando como leído:', error.message);
        }
    }, [user, apiRequest]);

    // Cerrar conversación (solo admin)
    const closeConversation = useCallback(async (conversationId) => {
        if (!conversationId || user.userType !== 'admin') return false;
        
        debugLog(`Cerrando conversación: ${conversationId}`);
        
        try {
            await apiRequest(`/admin/close/${conversationId}`, { method: 'PUT' });
            
            // Actualizar estado local
            setConversations(prev => prev.map(conv => 
                conv.conversationId === conversationId 
                    ? { ...conv, status: 'closed' }
                    : conv
            ));
            
            debugLog('✅ Conversación cerrada');
            return true;
        } catch (error) {
            debugLog('❌ Error cerrando conversación:', error.message);
            setError('Error al cerrar conversación');
            return false;
        }
    }, [user, apiRequest]);

    // Seleccionar conversación activa
    const selectConversation = useCallback(async (conversation) => {
        if (!conversation) return;
        
        debugLog(`Seleccionando conversación: ${conversation.conversationId}`);
        
        setActiveConversation(conversation);
        setMessages([]);
        setCurrentPage(1);
        setHasMoreMessages(true);
        lastMessageCountRef.current = 0;
        
        await getMessages(conversation.conversationId, 1, true, true);
        await markAsRead(conversation.conversationId);
    }, [getMessages, markAsRead]);

    // Cargar más mensajes (paginación)
    const loadMoreMessages = useCallback(async () => {
        if (!activeConversation || !hasMoreMessages || loadingMessages) return;
        
        const nextPage = currentPage + 1;
        await getMessages(activeConversation.conversationId, nextPage, false, true);
    }, [activeConversation, hasMoreMessages, loadingMessages, currentPage, getMessages]);

    // Polling optimizado - SOLO PARA NUEVOS MENSAJES
    const checkForNewMessages = useCallback(async () => {
        try {
            if (user.userType === 'admin') {
                // Para admin: verificar solo cambios en conversaciones
                await getAllConversations(false);
            }
            
            // Verificar nuevos mensajes solo si hay conversación activa
            if (activeConversationRef.current) {
                const data = await apiRequest(`/messages/${activeConversationRef.current.conversationId}?page=1&limit=10`);
                const latestMessages = data.messages || [];
                
                // Solo actualizar si hay mensajes nuevos
                setMessages(prevMessages => {
                    if (latestMessages.length > 0 && prevMessages.length > 0) {
                        const newMessagesExist = latestMessages.some(msg => 
                            prevMessages.findIndex(prevMsg => prevMsg._id === msg._id) === -1
                        );
                        
                        if (newMessagesExist) {
                            debugLog('🔔 Nuevos mensajes detectados');
                            // Combinar mensajes sin duplicados
                            const allMessages = [...prevMessages];
                            latestMessages.forEach(newMsg => {
                                if (!allMessages.find(msg => msg._id === newMsg._id)) {
                                    allMessages.push(newMsg);
                                }
                            });
                            setTimeout(() => scrollToBottom(), 100);
                            return allMessages;
                        }
                    }
                    return prevMessages;
                });
            }
        } catch (error) {
            debugLog('❌ Error checking for new messages:', error.message);
        }
    }, [user, apiRequest, getAllConversations, scrollToBottom]);

    // Inicializar polling controlado
    const startPolling = useCallback(() => {
        if (pollingIntervalRef.current) return;
        
        debugLog('🔄 Iniciando polling cada 15 segundos');
        pollingIntervalRef.current = setInterval(checkForNewMessages, 15000); // Cada 15 segundos
    }, [checkForNewMessages]);

    const stopPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            debugLog('⏹️ Deteniendo polling');
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    }, []);

    // Inicializar chat según tipo de usuario - CON CONTROL DE INICIALIZACIÓN
    const initializeChat = useCallback(async () => {
        if (!isAuthenticated || !user || isInitializedRef.current) {
            debugLog('❌ No se puede inicializar chat:', { isAuthenticated, hasUser: !!user, isInitialized: isInitializedRef.current });
            return;
        }
        
        debugLog('🚀 Inicializando chat para usuario:', user);
        isInitializedRef.current = true;
        setIsConnected(true);
        
        try {
            if (user.userType === 'admin') {
                debugLog('👑 Inicializando chat para admin');
                await getAllConversations(true);
            } else if (user.userType === 'Customer') {
                debugLog('👤 Inicializando chat para cliente');
                const conversation = await getOrCreateConversation(true);
                if (conversation) {
                    await selectConversation(conversation);
                }
            }
            
            startPolling();
            debugLog('✅ Chat inicializado correctamente');
        } catch (error) {
            debugLog('❌ Error inicializando chat:', error.message);
            setError('Error al inicializar el chat');
            isInitializedRef.current = false;
        }
    }, [isAuthenticated, user, getAllConversations, getOrCreateConversation, selectConversation, startPolling]);

    // Limpiar recursos
    const cleanup = useCallback(() => {
        debugLog('🧹 Limpiando recursos del chat');
        stopPolling();
        setConversations([]);
        setActiveConversation(null);
        setMessages([]);
        setNewMessage('');
        setIsConnected(false);
        setError(null);
        isInitializedRef.current = false;
        lastMessageCountRef.current = 0;
    }, [stopPolling]);

    // Effect principal - CONTROLADO PARA EVITAR BUCLES
    useEffect(() => {
        debugLog('🔍 UseEffect principal - verificando estado:', { 
            isAuthenticated, 
            userId: user?.id, 
            userType: user?.userType, 
            isInitialized: isInitializedRef.current 
        });
        
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
    }, [isAuthenticated, user?.id, user?.userType]); // Solo dependencias esenciales

    // Cleanup al desmontar
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
        
        debugLog('🔄 Refrescando chat manualmente');
        
        try {
            if (user.userType === 'admin') {
                await getAllConversations(true);
            }
            
            if (activeConversation) {
                await getMessages(activeConversation.conversationId, 1, true, true);
            }
            
            debugLog('✅ Chat refrescado');
        } catch (error) {
            debugLog('❌ Error refrescando chat:', error.message);
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
        isConnected,
        unreadCount,
        hasMoreMessages,
        loadingMessages,
        
        // Setters
        setNewMessage,
        
        // Acciones
        sendMessage,
        selectConversation,
        markAsRead,
        closeConversation,
        loadMoreMessages,
        scrollToBottom,
        clearError,
        refresh,
        
        // Refs
        messagesEndRef
    };
};