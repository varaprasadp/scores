// src/components/SlotList.jsx
import React from 'react';

function SlotList({ slots, selectedSlot, handleCreateNewSlot, handleSelectSlot }) {
  return (
    <div className="mb-8">
      <button
        onClick={handleCreateNewSlot}
        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 mb-6"
      >
        Create New Slot
      </button>

      {slots.length === 0 ? (
        <p className="text-white text-center text-lg">No slots created yet. Click "Create New Slot" to start!</p>
      ) : (
        <ul className="space-y-4">
          <h3 className="text-xl font-semibold text-white mb-2">Existing Slots:</h3>
          {slots.map((slot) => (
            <li
              key={slot.id}
              className={`bg-white bg-opacity-15 backdrop-blur-sm rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center shadow-md ${selectedSlot && selectedSlot.id === slot.id ? 'border-2 border-purple-300' : ''}`}
            >
              <span className="text-lg font-medium text-white mb-2 sm:mb-0">
                Slot ID: {slot.slotId} ({slot.date}) - Created by: {slot.userName}
              </span>
              <button
                onClick={() => handleSelectSlot(slot)}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg shadow-sm transition duration-300"
              >
                {selectedSlot && selectedSlot.id === slot.id ? 'Selected' : 'Select Slot'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SlotList;
