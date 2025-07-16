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
    const isFirstLoadRef = useRef(true);
    
    const { user, isAuthenticated } = useAuth();

    // URLs base de la API
    const API_BASE = "http://localhost:4000/api/chat";

    // Función para hacer peticiones a la API con manejo de errores
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
                throw new Error(data.message || 'Error en la petición');
            }
            
            return data;
        } catch (error) {
            console.error('Error en API request:', error);
            throw error;
        }
    }, []);

    // Obtener o crear conversación para el cliente actual
    const getOrCreateConversation = useCallback(async () => {
        if (!user?.id || user.userType !== 'Customer') return null;
        
        try {
            setLoading(true);
            const data = await apiRequest(`/conversation/${user.id}`);
            return data.conversation;
        } catch (error) {
            setError('Error al obtener conversación');
            console.error('Error getting conversation:', error);
            return null;
        } finally {
            setLoading(false);
        }
    }, [user, apiRequest]);

    // Obtener todas las conversaciones (para admin)
    const getAllConversations = useCallback(async () => {
        if (!user || user.userType !== 'admin') return;
        
        try {
            setLoading(true);
            const data = await apiRequest('/admin/conversations');
            setConversations(data.conversations || []);
            
            // Calcular mensajes no leídos
            const totalUnread = data.conversations?.reduce((sum, conv) => 
                sum + (conv.unreadCountAdmin || 0), 0) || 0;
            setUnreadCount(totalUnread);
        } catch (error) {
            setError('Error al obtener conversaciones');
            console.error('Error getting conversations:', error);
        } finally {
            setLoading(false);
        }
    }, [user, apiRequest]);

    // Obtener mensajes de una conversación específica
    const getMessages = useCallback(async (conversationId, page = 1, resetMessages = false) => {
        if (!conversationId) return;
        
        try {
            setLoadingMessages(true);
            const data = await apiRequest(`/messages/${conversationId}?page=${page}&limit=50`);
            
            if (resetMessages || page === 1) {
                setMessages(data.messages || []);
                setCurrentPage(1);
            } else {
                setMessages(prev => [...(data.messages || []), ...prev]);
            }
            
            setHasMoreMessages(data.pagination?.hasNextPage || false);
            setCurrentPage(page);
            
            // Auto-scroll al final en la primera carga
            if (resetMessages || page === 1) {
                setTimeout(() => scrollToBottom(), 100);
            }
        } catch (error) {
            setError('Error al obtener mensajes');
            console.error('Error getting messages:', error);
        } finally {
            setLoadingMessages(false);
        }
    }, [apiRequest]);

    // Enviar un mensaje
    const sendMessage = useCallback(async (conversationId, message) => {
        if (!conversationId || !message.trim()) return false;
        
        try {
            const data = await apiRequest('/message', {
                method: 'POST',
                body: JSON.stringify({
                    conversationId,
                    message: message.trim()
                })
            });
            
            // Agregar el mensaje a la lista local
            setMessages(prev => [...prev, data.message]);
            setNewMessage('');
            
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
            setError('Error al enviar mensaje');
            console.error('Error sending message:', error);
            return false;
        }
    }, [user, apiRequest]);

    // Marcar mensajes como leídos
    const markAsRead = useCallback(async (conversationId) => {
        if (!conversationId) return;
        
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
                setUnreadCount(prev => Math.max(0, prev - (activeConversation?.unreadCountAdmin || 0)));
            }
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    }, [user, activeConversation, apiRequest]);

    // Cerrar conversación (solo admin)
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
            console.error('Error closing conversation:', error);
            return false;
        }
    }, [user, apiRequest]);

    // Seleccionar conversación activa
    const selectConversation = useCallback(async (conversation) => {
        setActiveConversation(conversation);
        setMessages([]);
        setCurrentPage(1);
        setHasMoreMessages(true);
        
        if (conversation) {
            await getMessages(conversation.conversationId, 1, true);
            await markAsRead(conversation.conversationId);
        }
    }, [getMessages, markAsRead]);

    // Cargar más mensajes (paginación)
    const loadMoreMessages = useCallback(async () => {
        if (!activeConversation || !hasMoreMessages || loadingMessages) return;
        
        const nextPage = currentPage + 1;
        await getMessages(activeConversation.conversationId, nextPage, false);
    }, [activeConversation, hasMoreMessages, loadingMessages, currentPage, getMessages]);

    // Función para hacer scroll al final
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    // Polling para actualizaciones en tiempo real
    const startPolling = useCallback(() => {
        if (pollingIntervalRef.current) return;
        
        pollingIntervalRef.current = setInterval(async () => {
            try {
                if (user.userType === 'admin') {
                    await getAllConversations();
                }
                
                if (activeConversation) {
                    // Solo obtener mensajes nuevos si hay conversación activa
                    await getMessages(activeConversation.conversationId, 1, true);
                }
            } catch (error) {
                console.error('Error in polling:', error);
            }
        }, 5000); // Polling cada 5 segundos
    }, [user, activeConversation, getAllConversations, getMessages]);

    const stopPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    }, []);

    // Inicializar chat según tipo de usuario
    const initializeChat = useCallback(async () => {
        if (!isAuthenticated || !user) return;
        
        setIsConnected(true);
        
        try {
            if (user.userType === 'admin') {
                await getAllConversations();
            } else if (user.userType === 'Customer') {
                const conversation = await getOrCreateConversation();
                if (conversation) {
                    await selectConversation(conversation);
                }
            }
            
            startPolling();
        } catch (error) {
            console.error('Error initializing chat:', error);
            setError('Error al inicializar el chat');
        }
    }, [isAuthenticated, user, getAllConversations, getOrCreateConversation, selectConversation, startPolling]);

    // Limpiar recursos
    const cleanup = useCallback(() => {
        stopPolling();
        setConversations([]);
        setActiveConversation(null);
        setMessages([]);
        setNewMessage('');
        setIsConnected(false);
        setError(null);
    }, [stopPolling]);

    // Effect principal - inicializar o limpiar según autenticación
    useEffect(() => {
        if (isAuthenticated && user) {
            initializeChat();
        } else {
            cleanup();
        }
        
        return cleanup;
    }, [isAuthenticated, user]);

    // Effect para manejar cambios en conversación activa
    useEffect(() => {
        if (activeConversation && isFirstLoadRef.current) {
            isFirstLoadRef.current = false;
            setTimeout(() => scrollToBottom(), 500);
        }
    }, [activeConversation, scrollToBottom]);

    // Función para limpiar errores
    const clearError = useCallback(() => {
        setError(null);
    }, []);

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
        
        // Refs
        messagesEndRef,
        
        // Funciones de utilidad
        refresh: initializeChat
    };
};