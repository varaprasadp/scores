import React from 'react';

function ConfirmationDialog({ title, message, onConfirm, onCancel, show }) {
  if (!show) {
    return null;
  }

  const buttonClass = "w-full sm:w-auto px-4 py-2.5 text-sm font-medium rounded-md shadow-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[110] p-3 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-sm border-t-4 border-yellow-500">
        <h3 className="text-lg sm:text-xl font-semibold text-white mb-3 border-b border-gray-700 pb-3">
          {title}
        </h3>
        <p className="text-gray-300 text-sm sm:text-base mb-6">{message}</p>
        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
          <button
            onClick={onCancel}
            className={`${buttonClass} bg-gray-600 hover:bg-gray-500 text-white focus:ring-gray-400`}
          >
            No, Keep It
          </button>
          <button
            onClick={onConfirm}
            className={`${buttonClass} bg-red-600 hover:bg-red-700 text-white focus:ring-red-500`}
          >
            Yes, Proceed
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationDialog;