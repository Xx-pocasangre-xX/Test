import React from 'react';

const DeleteMessageModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    message, 
    isDeleting,
    formatTime 
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-200 bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all">
                {/* Header del modal */}
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                                Eliminar mensaje
                            </h3>
                            <p className="text-sm text-gray-500" style={{ fontFamily: 'Poppins, sans-serif' }}>
                                Esta acción no se puede deshacer
                            </p>
                        </div>
                    </div>
                </div>

                {/* Contenido del modal */}
                <div className="p-6">
                    <div className="mb-4">
                        <p className="text-gray-700 mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                            ¿Estás seguro de que quieres eliminar este mensaje?
                        </p>
                        
                        {/* Preview del mensaje a eliminar */}
                        {message && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <div className="flex items-start space-x-3">
                                    <div className="w-8 h-8 bg-[#E8ACD2] rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                                        {message.senderId?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 mb-1">
                                            {message.senderId?.fullName || 'Usuario'}
                                        </p>
                                        <p className="text-sm text-gray-600 break-words">
                                            {message.message || '📎 Archivo multimedia'}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {formatTime(message.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div className="flex items-start space-x-2">
                            <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <p className="text-sm text-amber-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                                El mensaje será eliminado permanentemente y no podrá ser recuperado.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Botones del modal */}
                <div className="px-6 py-4 border-t border-gray-100 flex space-x-3">
                    <button
                        onClick={onClose}
                        disabled={isDeleting}
                        className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E8ACD2] disabled:opacity-50 transition-colors"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors flex items-center justify-center"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                    >
                        {isDeleting ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Eliminando...
                            </>
                        ) : (
                            'Eliminar mensaje'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteMessageModal;