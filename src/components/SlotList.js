import React from 'react';

function SlotList({ slots, handleCreateNewSlot, handleSelectSlot }) {
  const baseButtonClass = "w-full text-left rounded-lg p-3 sm:p-4 shadow-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-opacity-75";

  return (
    <div className="space-y-3 sm:space-y-4">
      <button
        onClick={handleCreateNewSlot}
        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-900 text-sm sm:text-base"
      >
        + Create New Slot
      </button>

      {slots.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-6 text-center shadow-md">
          <p className="text-gray-400 text-sm sm:text-base">
            No slots yet. Tap "Create New Slot" to begin! ✨
          </p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {slots.map((slot) => (
            <button
              key={slot.id}
              onClick={() => handleSelectSlot(slot)}
              className={`${baseButtonClass} bg-gray-800 hover:bg-gray-700 focus:ring-purple-500`}
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
                <span className="text-xs text-gray-500 block mt-1 truncate">
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