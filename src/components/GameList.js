// src/components/GameList.jsx
import React from 'react';

function GameList({ games }) {
  if (games.length === 0) {
    return (
      <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 shadow-lg mt-8">
        <p className="text-white text-center text-lg">No games played in this slot yet.</p>
      </div>
    );
  }

  // 1. Get all unique player names across all games
  const allPlayerNames = [...new Set(games.flatMap(game => game.players.map(player => player.name)))];
  allPlayerNames.sort(); // Optional: sort players alphabetically for consistent column order

  // 2. Calculate player totals
  const playerTotals = {};
  allPlayerNames.forEach(name => (playerTotals[name] = 0));

  games.forEach(game => {
    game.players.forEach(player => {
      playerTotals[player.name] += player.score;
    });
  });

  return (
    <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 shadow-lg mt-8 overflow-x-auto">
      <h3 className="text-xl font-bold text-white mb-4">Past Games Summary</h3>
      <table className="min-w-full divide-y divide-gray-700">
        <thead className="bg-gray-800 bg-opacity-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              Game
            </th>
            {/* Player Headers */}
            {allPlayerNames.map((playerName) => (
              <th
                key={playerName}
                scope="col"
                className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider"
              >
                {playerName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {/* Game Rows (vertical) */}
          {games.slice().reverse().map((game) => { // Reverse to show latest game at the top
            const isLatestGame = game.id === games[0].id; // Check if it's the latest game for styling
            return (
              <tr key={game.id} className="hover:bg-gray-700 hover:bg-opacity-20">
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-white">
                  Game {game.gameNumber}
                  {game.winnerPlayerName && (
                    <p className="font-normal text-green-400 text-xxs mt-1">({game.winnerPlayerName} won)</p>
                  )}
                </td>
                {/* Scores for each player in this game */}
                {allPlayerNames.map((playerName) => {
                  const playerInGame = game.players.find(p => p.name === playerName);
                  const score = playerInGame ? playerInGame.score : 0;
                  const displayScore = playerInGame ? (score >= 0 ? `+${score}` : score) : '-'; // Display '-' if player not in game
                  const cellClasses = playerInGame
                    ? (score > 0 ? 'text-green-300 font-semibold' : (score < 0 ? 'text-red-300 font-semibold' : 'text-white'))
                    : 'text-gray-400'; // Style for players who didn't play that game

                  return (
                    <td key={`${game.id}-${playerName}`} className={`px-4 py-4 whitespace-nowrap text-sm text-center ${cellClasses}`}>
                      {displayScore}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        {/* Total Score Row */}
        <tfoot className="bg-gray-800 bg-opacity-70 border-t border-gray-600">
          <tr>
            <th scope="row" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              Total
            </th>
            {allPlayerNames.map((playerName) => {
              const total = playerTotals[playerName];
              const totalClasses = total >= 0 ? 'text-blue-300' : 'text-orange-300';
              return (
                <td key={`total-${playerName}`} className={`px-4 py-3 whitespace-nowrap text-sm font-bold text-center ${totalClasses}`}>
                  {total >= 0 ? `+${total}` : total}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default GameList;
