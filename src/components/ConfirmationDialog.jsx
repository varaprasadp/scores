// src/components/ConfirmationDialog.js
import React from 'react';

function ConfirmationDialog({ title, message, onConfirm, onCancel, show }) {
  if (!show) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[110] p-3 backdrop-blur-sm"> {/* Higher z-index than PlayerManager */}
      <div className="bg-gray-800 rounded-lg shadow-xl p-4 sm:p-5 w-full max-w-sm border-t-4 border-yellow-500">
        <h3 className="text-lg sm:text-xl font-semibold text-white mb-3 border-b border-gray-700 pb-3">
          {title}
        </h3>
        <p className="text-gray-300 text-sm sm:text-base mb-6">{message}</p>
        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
          <button
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2.5 text-sm bg-gray-600 hover:bg-gray-500 text-white font-medium rounded-md shadow-md transition-colors"
          >
            No, Keep It
          </button>
          <button
            onClick={onConfirm}
            className="w-full sm:w-auto px-4 py-2.5 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-md shadow-md transition-colors"
          >
            Yes, Proceed
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationDialog;