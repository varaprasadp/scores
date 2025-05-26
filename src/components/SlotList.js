// src/components/SlotList.js
import React from 'react';

function SlotList({ slots, handleCreateNewSlot, handleSelectSlot }) {
  return (
    <div className="space-y-3">
      <button
        onClick={handleCreateNewSlot}
        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out transform hover:scale-102 mb-4 text-sm sm:text-base"
      >
        + Create New Slot
      </button>

      {slots.length === 0 ? (
        <p className="text-gray-400 text-center py-4 text-sm sm:text-base">
          No slots yet. Tap "Create New Slot" to begin! ✨
        </p>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {slots.map((slot) => (
            <button
              key={slot.id}
              onClick={() => handleSelectSlot(slot)}
              className="w-full text-left bg-gray-800 hover:bg-gray-700 rounded-lg p-3 sm:p-4 shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
            >
              <div className="flex justify-between items-center">
                <span className="text-base sm:text-lg font-medium text-white">
                  Slot: {slot.slotId}
                </span>
                <span className="text-xs sm:text-sm text-gray-400 flex-shrink-0 ml-2">
                  {slot.date}
                </span>
              </div>
              {slot.userName && (
                <span className="text-xs text-gray-500 block mt-1">
                  By: {slot.userName}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default SlotList;