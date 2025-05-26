// src/components/PlayerManager.jsx
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      {/* Changed background to be consistent with the main app's semi-transparent, blurred look */}
      <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-xl p-6 shadow-2xl w-full max-w-md relative text-gray-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-300 hover:text-white text-2xl font-bold transition duration-200"
        >
          &times;
        </button>
        <h2 className="text-2xl font-bold mb-6 text-center text-white">Manage Players</h2>

        {/* Add New Player Form */}
        <form onSubmit={handleAddSubmit} className="mb-6 flex gap-2">
          <input
            type="text"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="Add new player name"
            // Input style updated for consistency
            className="flex-grow p-3 rounded-lg bg-white bg-opacity-20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent transition duration-200"
          />
          <button
            type="submit"
            // Button style updated for consistency
            className="px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          >
            Add
          </button>
        </form>

        {/* Master Player List */}
        <h3 className="text-lg font-semibold mb-3 text-white">Your Players:</h3>
        {masterPlayerList.length === 0 ? (
          <p className="text-gray-300 text-center">No players in your master list yet.</p>
        ) : (
          <ul className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {masterPlayerList.map(player => (
              <li key={player.id}
                  // List item background updated for consistency
                  className="flex items-center justify-between bg-white bg-opacity-15 p-3 rounded-lg shadow-sm"
              >
                <span className="font-medium text-white">{player.name}</span>
                <button
                  onClick={() => onRemovePlayer(player.id, player.name)}
                  // Remove button icon and color updated for consistency
                  className="p-2 text-red-300 hover:text-red-500 transition duration-200 rounded-full hover:bg-white hover:bg-opacity-10"
                  title={`Remove ${player.name}`}
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
    </div>
  );
}

export default PlayerManager;