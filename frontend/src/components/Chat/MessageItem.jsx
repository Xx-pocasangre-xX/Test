import React from 'react';

const MessageItem = ({ 
    message, 
    isCurrentUser, 
    showDate, 
    formatTime, 
    formatDate, 
    onDeleteMessage,
    renderMediaContent,
    canDelete = false
}) => {
    const isAdmin = message.senderType === 'admin';
    const isClient = message.senderType === 'Customer';

    return (
        <div key={message._id}>
            {showDate && (
                <div className="text-center mb-4">
                    <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        {formatDate(message.createdAt)}
                    </span>
                </div>
            )}
            
            <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                <div className="group max-w-xs lg:max-w-md relative">
                    {/* Avatar y nombre para mensajes de otros usuarios */}
                    {!isCurrentUser && (
                        <div className="flex items-center space-x-2 mb-1">
                            <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                                {message.senderId?.profilePicture ? (
                                    <img 
                                        src={message.senderId.profilePicture} 
                                        alt={message.senderId.fullName}
                                        className="w-full h-full rounded-full object-cover"
                                    />
                                ) : (
                                    <span className="text-xs text-gray-600">
                                        {message.senderId?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                                    </span>
                                )}
                            </div>
                            <span className="text-xs text-gray-600">
                                {message.senderId?.fullName || (isAdmin ? 'Atención al Cliente' : 'Cliente')}
                            </span>
                        </div>
                    )}
                    
                    <div className={`px-4 py-2 rounded-lg relative ${
                        isCurrentUser 
                            ? 'bg-[#E8ACD2] text-white' 
                            : 'bg-gray-100 text-gray-900'
                    }`}>
                        {/* Contenido multimedia */}
                        {message.media && (
                            <div className="mb-2">
                                {renderMediaContent(message.media)}
                            </div>
                        )}
                        
                        {/* Mensaje de texto */}
                        {message.message && (
                            <p className="text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                                {message.message}
                            </p>
                        )}
                        
                        {/* Hora */}
                        <p className={`text-xs mt-1 ${
                            isCurrentUser ? 'text-white text-opacity-80' : 'text-gray-500'
                        }`}>
                            {formatTime(message.createdAt)}
                        </p>
                    </div>

                    {/* Botón de eliminar - Solo visible si se puede eliminar */}
                    {canDelete && (
                        <div className={`absolute top-0 ${isCurrentUser ? '-left-12' : '-right-12'} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
                            <button
                                onClick={() => onDeleteMessage(message)}
                                className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-colors"
                                title="Eliminar mensaje"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessageItem;