import React from 'react';

function GameList({ games, selectedGame, handleCreateNewGame, handleSelectGame }) {
  return (
    <div className="mb-8">
      <button
        onClick={handleCreateNewGame}
        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 mb-6"
      >
        Create New Game
      </button>

      {games.length === 0 ? (
        <p className="text-white text-center text-lg">No games created yet. Click "Create New Game" to start!</p>
      ) : (
        <ul className="space-y-4">
          <h3 className="text-xl font-semibold text-white mb-2">Existing Games:</h3>
          {games.map((game) => (
            <li
              key={game.id}
              className={`bg-white bg-opacity-15 backdrop-blur-sm rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center shadow-md ${selectedGame && selectedGame.id === game.id ? 'border-2 border-purple-300' : ''}`}
            >
              <span className="text-lg font-medium text-white mb-2 sm:mb-0">
                Game ID: {game.gameId} ({game.date}) - Created by: {game.userName}
              </span>
              <button
                onClick={() => handleSelectGame(game)}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg shadow-sm transition duration-300"
              >
                {selectedGame && selectedGame.id === game.id ? 'Selected' : 'Select Game'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default GameList;