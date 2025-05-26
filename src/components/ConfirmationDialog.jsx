// src/components/ConfirmationDialog.jsx
import React from 'react';

function ConfirmationDialog({ title, message, onConfirm, onCancel, show }) {
  if (!show) {
    return null; // Don't render if not visible
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-lg shadow-xl p-6 w-full max-w-sm sm:max-w-md border-t-4 border-yellow-400 transform scale-100 transition-transform duration-300">
        <h3 className="text-xl font-bold text-white mb-4 border-b pb-2 border-purple-400">
          {title}
        </h3>
        <p className="text-gray-100 mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-5 py-2 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-md shadow-md transition duration-200 ease-in-out transform hover:scale-105"
          >
            No, Keep It
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md shadow-md transition duration-200 ease-in-out transform hover:scale-105"
          >
            Yes, Cancel Game
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationDialog;