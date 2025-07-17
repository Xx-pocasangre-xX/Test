import React from 'react';

const FilePreview = ({ selectedFile, previewUrl, onClear }) => {
    if (!selectedFile) return null;

    return (
        <div className="p-3 md:p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    {previewUrl ? (
                        <img src={previewUrl} alt="Preview" className="w-12 h-12 rounded object-cover" />
                    ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                    )}
                    <div>
                        <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                </div>
                <button
                    onClick={onClear}
                    className="text-red-600 hover:text-red-800"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default FilePreview;