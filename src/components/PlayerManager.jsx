import React, { useState } from 'react';

function PlayerManager({ masterPlayerList, onAddPlayer, onRemovePlayer, onClose }) {
  const [newPlayerName, setNewPlayerName] = useState('');

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (newPlayerName.trim()) {
      onAddPlayer(newPlayerName.trim());
      setNewPlayerName('');
    }
  };

  const inputClass = "p-2.5 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm";
  const buttonClass = "px-4 py-2.5 text-sm font-medium rounded-md shadow-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100] p-3 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-lg p-4 sm:p-6 shadow-xl w-full max-w-md text-gray-200 relative border-t-4 border-purple-600">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-100 p-2 rounded-full transition-colors"
          aria-label="Close player manager"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h2 className="text-lg sm:text-xl font-semibold mb-4 text-center text-white border-b border-gray-700 pb-3">
          Manage Player Roster
        </h2>

        <form onSubmit={handleAddSubmit} className="mb-5 flex flex-col sm:flex-row gap-2 sm:gap-3">
          <input
            type="text"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="Enter new player name"
            className={`flex-grow ${inputClass}`}
            aria-label="New player name input"
          />
          <button
            type="submit"
            className={`${buttonClass} bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-500`}
          >
            Add Player
          </button>
        </form>

        <h3 className="text-sm sm:text-base font-medium mb-2 text-gray-300">Your Roster:</h3>
        {masterPlayerList.length === 0 ? (
          <div className="bg-gray-700 bg-opacity-50 rounded-md p-4 text-center">
            <p className="text-gray-400 text-xs sm:text-sm">No players added yet. Use the form above!</p>
          </div>
        ) : (
          <ul className="space-y-2 max-h-52 sm:max-h-60 overflow-y-auto pr-1 custom-scrollbar-thin">
            {masterPlayerList.map(player => (
              <li key={player.id}
                  className="flex items-center justify-between bg-gray-700 bg-opacity-70 p-2.5 rounded-md hover:bg-gray-700 transition-colors"
              >
                <span className="font-normal text-gray-100 text-sm truncate pr-2" title={player.name}>{player.name}</span>
                <button
                  onClick={() => onRemovePlayer(player.id, player.name)}
                  className="p-1.5 text-red-400 hover:text-red-300 transition-colors rounded-full hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-red-500 focus:ring-offset-1 focus:ring-offset-gray-700"
                  title={`Remove ${player.name}`}
                  aria-label={`Remove ${player.name}`}
                >
                  <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd"></path>
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
         <div className="mt-5 pt-4 border-t border-gray-700 flex justify-end">
            <button
                onClick={onClose}
                className={`${buttonClass} bg-gray-600 hover:bg-gray-500 text-white focus:ring-gray-500`}
            >
                Done
            </button>
        </div>
      </div>
    </div>
  );
}

export default PlayerManager;