// src/components/CreateSlotModal.js

import React, { useState } from 'react';

function CreateSlotModal({ onClose, onCreate }) {
  const [dropValue, setDropValue] = useState(1);

  const handleSubmit = (e) => {
    e.preventDefault();
    const value = parseInt(dropValue, 10);
    if (!isNaN(value) && value >= 0) {
      onCreate(value);
    }
  };

  const buttonClass = "w-full sm:w-auto px-4 py-2.5 text-sm font-medium rounded-md shadow-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800";
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[110] p-3 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-sm border-t-4 border-green-500">
        <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 border-b border-gray-700 pb-3">
          Create New Slot
        </h3>

        <div className="mb-6">
          <label htmlFor="dropValue" className="block text-sm font-medium text-gray-300 mb-2">
            Drop Value
          </label>
          <input
            id="dropValue"
            type="number"
            value={dropValue}
            onChange={(e) => setDropValue(e.target.value)}
            className="p-2.5 w-full rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            min="0"
            step="1"
          />
          <p className="text-xs text-gray-400 mt-2">
            This is the score assigned to a player when they are dropped from a game. Default is 1.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className={`${buttonClass} bg-gray-600 hover:bg-gray-500 text-white focus:ring-gray-400`}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`${buttonClass} bg-green-600 hover:bg-green-700 text-white focus:ring-green-500`}
          >
            Create Slot
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateSlotModal;
