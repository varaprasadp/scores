import React, { useState, useMemo } from 'react';

// A new, self-contained component for a single date group in the accordion
function DateGroup({ date, slotsForDate, handleSelectSlot, handleDeleteSlot, isExpanded, onToggle }) {
  // A simple function to format the date for display
  const formattedDate = useMemo(() => {
    const today = new Date();
    const slotDate = new Date(date);
    today.setHours(0, 0, 0, 0);
    slotDate.setHours(0, 0, 0, 0);

    if (slotDate.getTime() === today.getTime()) {
      return 'Today';
    }
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [date]);

  return (
    <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
      {/* The clickable header for the date group */}
      <button
        onClick={onToggle}
        className="w-full flex justify-between items-center p-4 text-left bg-gray-700 hover:bg-gray-600 transition-colors"
        aria-expanded={isExpanded}
      >
        <span className="font-semibold text-white">{formattedDate}</span>
        <span className="text-gray-400 text-sm">
          {slotsForDate.length} {slotsForDate.length === 1 ? 'slot' : 'slots'}
        </span>
        <svg
          className={`w-5 h-5 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* The content area that shows when the group is expanded */}
      {isExpanded && (
        <ul className="p-2 space-y-2 bg-gray-800">
          {slotsForDate.map((slot) => (
            <li
              key={slot.id}
              className="flex items-center justify-between bg-gray-700 bg-opacity-50 rounded-md hover:bg-gray-600 transition-colors shadow-sm"
            >
              <button
                onClick={() => handleSelectSlot(slot)}
                className="flex-grow text-left p-3 rounded-l-md"
              >
                <span className="font-bold text-base text-white">Slot {slot.slotId}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSlot(slot);
                }}
                className="p-3 text-red-500 hover:text-red-400 rounded-r-md"
                title={`Delete Slot ${slot.slotId}`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SlotList({ slots, handleCreateNewSlot, handleSelectSlot, handleDeleteSlot }) {
  const [expandedDate, setExpandedDate] = useState(null);

  // Group slots by their date string
  const groupedSlots = useMemo(() => {
    return slots.reduce((acc, slot) => {
      const date = slot.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(slot);
      return acc;
    }, {});
  }, [slots]);

  // Set the most recent date group to be expanded by default
  useState(() => {
      if (Object.keys(groupedSlots).length > 0) {
          const mostRecentDate = Object.keys(groupedSlots).sort((a, b) => new Date(b) - new Date(a))[0];
          setExpandedDate(mostRecentDate);
      }
  }, [groupedSlots]);

  const toggleDateGroup = (date) => {
    setExpandedDate(expandedDate === date ? null : date);
  };

  const sortedDates = Object.keys(groupedSlots).sort((a, b) => new Date(b) - new Date(a));

  return (
    <div className="bg-gray-900 bg-opacity-50 rounded-lg p-3 sm:p-4 shadow-xl">
      <button
        onClick={handleCreateNewSlot}
        className="w-full mb-4 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500"
      >
        + Create New Slot
      </button>

      {slots.length > 0 ? (
        <div className="space-y-3">
          {sortedDates.map((date) => (
            <DateGroup
              key={date}
              date={date}
              slotsForDate={groupedSlots[date]}
              handleSelectSlot={handleSelectSlot}
              handleDeleteSlot={handleDeleteSlot}
              isExpanded={expandedDate === date}
              onToggle={() => toggleDateGroup(date)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 px-4 bg-gray-800 rounded-lg">
          <p className="text-gray-400">No slots found. Create one to get started!</p>
        </div>
      )}
    </div>
  );
}

export default SlotList;
