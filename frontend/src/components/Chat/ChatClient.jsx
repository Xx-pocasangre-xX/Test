import React from 'react';
import { useChat } from './Hooks/useChat';

const ChatClient = ({ isOpen, onClose }) => {
    const {
        activeConversation,
        messages,
        newMessage,
        setNewMessage,
        loading,
        error,
        sendMessage,
        clearError,
        messagesEndRef
    } = useChat();

    // Manejar envío de mensaje
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!activeConversation || !newMessage.trim()) return;
        
        const success = await sendMessage(activeConversation.conversationId, newMessage);
        if (success) {
            setNewMessage('');
        }
    };

    // Manejar tecla Enter
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    };

    // Formatear fecha y hora
    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDate = (date) => {
        const messageDate = new Date(date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (messageDate.toDateString() === today.toDateString()) {
            return 'Hoy';
        } else if (messageDate.toDateString() === yesterday.toDateString()) {
            return 'Ayer';
        } else {
            return messageDate.toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'short'
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50">
            <div className="bg-white rounded-lg shadow-xl w-80 h-96 flex flex-col border border-gray-200">
                {/* Header del chat */}
                <div className="bg-[#E8ACD2] p-4 rounded-t-lg flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-white font-semibold text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                                Atención al cliente
                            </h3>
                            <p className="text-white text-opacity-80 text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
                                {loading ? 'Conectando...' : 'En línea'}
                            </p>
                        </div>
                    </div>
                    
                    <button
                        onClick={onClose}
                        className="text-white hover:text-gray-200 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E8ACD2]"></div>
                    </div>
                ) : (
                    <>
                        {/* Área de mensajes */}
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                            {/* Mensaje de bienvenida automático */}
                            <div className="mb-4">
                                <div className="flex justify-start">
                                    <div className="bg-white rounded-lg px-3 py-2 max-w-xs shadow-sm">
                                        <p className="text-sm text-gray-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                                            ¡Hola! Bienvenido a MARQUESA. ¿En qué podemos ayudarte hoy?
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {formatTime(new Date())}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Mensajes del chat */}
                            {messages.map((message, index) => {
                                const isClient = message.senderType === 'Customer';
                                const showDate = index === 0 || 
                                    formatDate(message.createdAt) !== formatDate(messages[index - 1].createdAt);
                                
                                return (
                                    <div key={message._id} className="mb-3">
                                        {showDate && (
                                            <div className="text-center mb-3">
                                                <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                                                    {formatDate(message.createdAt)}
                                                </span>
                                            </div>
                                        )}
                                        
                                        <div className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-xs rounded-lg px-3 py-2 shadow-sm ${
                                                isClient 
                                                    ? 'bg-[#E8ACD2] text-white' 
                                                    : 'bg-white text-gray-800'
                                            }`}>
                                                <p className="text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                                                    {message.message}
                                                </p>
                                                <p className={`text-xs mt-1 ${
                                                    isClient ? 'text-white text-opacity-70' : 'text-gray-500'
                                                }`}>
                                                    {formatTime(message.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input para escribir mensaje */}
                        <div className="p-3 bg-white border-t border-gray-200 rounded-b-lg">
                            <form onSubmit={handleSendMessage} className="flex space-x-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Escribe un mensaje..."
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8ACD2] focus:border-transparent"
                                    style={{ fontFamily: 'Poppins, sans-serif' }}
                                    disabled={!activeConversation}
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim() || !activeConversation}
                                    className="bg-[#E8ACD2] hover:bg-[#E096C8] text-white p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                </button>
                            </form>
                        </div>
                    </>
                )}

                {/* Modal de error */}
                {error && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                        <div className="bg-white rounded-lg p-4 max-w-xs mx-4">
                            <h3 className="text-lg font-semibold text-red-600 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                                Error
                            </h3>
                            <p className="text-gray-700 mb-3 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                                {error}
                            </p>
                            <button
                                onClick={clearError}
                                className="w-full px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                                style={{ fontFamily: 'Poppins, sans-serif' }}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatClient;