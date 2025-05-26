// src/components/GameList.jsx
import React from 'react';

// Icon for rotation, using a simple SVG for now.
// You might want to use a library like Heroicons for more robust icons.
const RotationIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-4 h-4 inline-block ml-1 align-middle text-yellow-300" // Adjusted color for visibility
  >
    <path
      fillRule="evenodd"
      d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903-1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V.375a.75.75 0 0 0-1.5 0v3.183l-1.903-1.903a9 9 0 0 0-15.002 4.134.75.75 0 1 0 1.48.217Zm14.245 4.932a7.5 7.5 0 0 1-12.548 3.364l-1.903 1.903h3.183a.75.75 0 0 0 0-1.5H.375a.75.75 0 0 0-.75.75v4.83a.75.75 0 0 0 1.5 0v-3.183l1.903 1.903a9 9 0 0 0 15.002-4.134.75.75 0 0 0-1.48-.217Z"
      clipRule="evenodd"
    />
  </svg>
);

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
      // Ensure player.score is treated as a number
      playerTotals[player.name] += (player.score || 0);
    });
  });

  return (
    <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6 shadow-lg mt-8 overflow-hidden"> {/* Changed to overflow-hidden for outer container */}
      <h3 className="text-2xl font-extrabold text-white mb-4">Past Games Summary</h3>
      <div className="relative overflow-x-auto rounded-lg shadow-inner-lg"> {/* Added overflow-x-auto here for scroll */}
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-800 bg-opacity-70 sticky top-0 z-20"> {/* Increased z-index for sticky header */}
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider min-w-[140px] sticky left-0 z-30 bg-gray-800 bg-opacity-70 shadow-lg" // Sticky left, higher z-index, specific background
              >
                Game
              </th>
              {/* Player Headers */}
              {allPlayerNames.map((playerName) => (
                <th
                  key={playerName}
                  scope="col"
                  className="px-4 py-3 text-center text-sm font-semibold text-gray-300 uppercase tracking-wider min-w-[100px]"
                >
                  {playerName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {/* Game Rows (vertical) */}
            {games.slice().reverse().map((game) => {
              const rowBackground = game.isRotationGame ? 'bg-purple-900 bg-opacity-30' : 'bg-gray-800 bg-opacity-20'; // Distinct background for rotation game

              return (
                <tr
                  key={game.id}
                  className={`transition-all duration-300 ease-in-out ${rowBackground} hover:bg-opacity-40`} // Apply dynamic background
                >
                  <td
                    className="px-4 py-4 whitespace-nowrap text-base font-medium text-white sticky left-0 z-10 shadow-md" // Sticky left, z-index, shadow
                    style={{ backgroundColor: game.isRotationGame ? 'rgba(67, 20, 107, 0.6)' : 'rgba(31, 41, 55, 0.6)' }} // Match sticky background
                  >
                    Game {game.gameNumber}
                    {game.winnerPlayerName && (
                      <p className="font-normal text-xs mt-1 text-green-400">
                        ({game.winnerPlayerName} won)
                      </p>
                    )}
                    {game.isRotationGame && (
                      <p className="font-semibold text-xs mt-1 text-yellow-300 flex items-center"> {/* Highlight rotation text more */}
                        <RotationIcon /> Rotation
                      </p>
                    )}
                  </td>
                  {/* Scores for each player in this game */}
                  {allPlayerNames.map((playerName) => {
                    const playerInGame = game.players.find(p => p.name === playerName);
                    const score = playerInGame ? playerInGame.score : null;

                    let displayScore;
                    let cellClasses;

                    if (playerInGame) {
                      displayScore = score >= 0 ? `+${score}` : score;
                      if (score > 0) {
                        cellClasses = 'text-green-300 font-bold bg-green-900 bg-opacity-25';
                      } else if (score < 0) {
                        cellClasses = 'text-red-300 font-bold bg-red-900 bg-opacity-25';
                      } else {
                        cellClasses = 'text-gray-100';
                      }
                    } else {
                      displayScore = 'N/P';
                      cellClasses = 'text-gray-400 italic text-opacity-80';
                    }

                    return (
                      <td
                        key={`${game.id}-${playerName}`}
                        className={`px-4 py-4 whitespace-nowrap text-base text-center ${cellClasses}`}
                      >
                        {displayScore}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          {/* Total Score Row */}
          <tfoot className="bg-gray-800 bg-opacity-95 border-t-2 border-purple-500 sticky bottom-0 z-20"> {/* Increased z-index for sticky footer */}
            <tr>
              <th
                scope="row"
                className="px-4 py-3 text-left text-lg font-extrabold text-white uppercase tracking-wider sticky left-0 z-30 bg-gray-800 bg-opacity-95 shadow-lg" // Sticky left, higher z-index, specific background
                style={{ backgroundColor: 'rgba(31, 41, 55, 0.95)' }} // Match sticky background
              >
                Total
              </th>
              {allPlayerNames.map((playerName) => {
                const total = playerTotals[playerName];
                const totalClasses = total >= 0 ? 'text-teal-300 bg-teal-900 bg-opacity-30' : 'text-orange-300 bg-red-900 bg-opacity-30';
                return (
                  <td
                    key={`total-${playerName}`}
                    className={`px-4 py-3 whitespace-nowrap text-lg font-extrabold text-center ${totalClasses}`}
                  >
                    {total >= 0 ? `+${total}` : total}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default GameList;