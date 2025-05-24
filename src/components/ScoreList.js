// src/components/ScoreList.js
import React from 'react';

function ScoreList({
  scores,
  editingScoreId,
  editingScoreValue,
  setEditingScoreValue,
  handleEditScore,
  handleUpdateScore,
  handleDeleteScore,
  setEditingScoreId
}) {
  if (scores.length === 0) {
    return (
      <p className="text-white text-center text-lg">No scores yet. Add one above!</p>
    );
  }

  return (
    <ul className="space-y-4">
      {scores.map((score) => (
        <li
          key={score.id}
          className="bg-white bg-opacity-15 backdrop-blur-sm rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center shadow-md"
        >
          {editingScoreId === score.id ? (
            <div className="flex flex-grow flex-col sm:flex-row gap-2 w-full">
              <input
                type="text"
                value={editingScoreValue}
                onChange={(e) => setEditingScoreValue(e.target.value)}
                className="flex-grow p-2 rounded-lg bg-white bg-opacity-30 text-white focus:outline-none focus:ring-2 focus:ring-purple-300 transition duration-200"
              />
              <div className="flex gap-2 mt-2 sm:mt-0">
                <button
                  onClick={() => handleUpdateScore(score.id)}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow-sm transition duration-300"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingScoreId(null)}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg shadow-sm transition duration-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <span className="text-lg font-medium text-white mb-2 sm:mb-0">
                {score.score}
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEditScore(score)}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold rounded-lg shadow-sm transition duration-300"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteScore(score.id)}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow-sm transition duration-300"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export default ScoreList;