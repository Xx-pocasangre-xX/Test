import React from 'react';

const MessageInput = ({
    newMessage,
    setNewMessage,
    onSendMessage,
    onKeyPress,
    onFileSelect,
    fileInputRef,
    activeConversation,
    isAdmin = false
}) => {
    return (
        <div className="p-3 md:p-4 border-t border-gray-200 bg-white flex-shrink-0">
            <form onSubmit={onSendMessage} className="flex items-end space-x-2 md:space-x-3">
                {/* Botón de archivo */}
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-shrink-0 p-2 text-gray-500 hover:text-[#E8ACD2] transition-colors"
                    title="Adjuntar archivo"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                </button>
                
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={onFileSelect}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                    className="hidden"
                />
                
                {isAdmin ? (
                    <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={onKeyPress}
                        placeholder="Escribe tu respuesta..."
                        className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8ACD2] focus:border-transparent min-h-[40px] max-h-24"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                        rows="1"
                        disabled={!activeConversation}
                    />
                ) : (
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={onKeyPress}
                        placeholder="Escribe un mensaje..."
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-[#E8ACD2] focus:border-transparent"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                        disabled={!activeConversation}
                    />
                )}
                
                <button
                    type="submit"
                    disabled={!newMessage.trim() || !activeConversation}
                    className="flex-shrink-0 px-3 md:px-4 py-2 bg-[#E8ACD2] text-white rounded-lg hover:bg-[#E096C8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                    {isAdmin ? (
                        <>
                            <span className="hidden md:inline">Enviar</span>
                            <svg className="w-4 h-4 md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </>
                    ) : (
                        <svg className="w-3 md:w-4 h-3 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    )}
                </button>
            </form>
        </div>
    );
};

export default MessageInput;