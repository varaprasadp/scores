// src/components/ScoreInput.js
import React from 'react';

function ScoreInput({ newScoreValue, setNewScoreValue, handleAddScore }) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <input
        type="text"
        value={newScoreValue}
        onChange={(e) => setNewScoreValue(e.target.value)}
        placeholder="Enter new score (e.g., 1200 points)"
        className="flex-grow p-3 rounded-lg bg-white bg-opacity-20 text-white placeholder-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300 transition duration-200"
      />
      <button
        onClick={handleAddScore}
        className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
      >
        Add Score
      </button>
    </div>
  );
}

export default ScoreInput;