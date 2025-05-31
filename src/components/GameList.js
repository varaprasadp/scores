import React from 'react';

const RotationIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20" // Adjusted viewBox for a 20x20 icon
    fill="currentColor"
    className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline-block mr-1 align-middle text-yellow-300"
  >
    <path
      fillRule="evenodd"
      d="M15.322 6.264a6.5 6.5 0 00-10.918 3.003.75.75 0 01-1.44-.433A8 8 0 0115.75 4.5h-2.015a.75.75 0 110-1.5H17.25A.75.75 0 0118 3.75v3.515a.75.75 0 11-1.5 0V4.94l-1.178 1.324zM4.678 13.736a6.5 6.5 0 0010.918-3.003.75.75 0 011.44.433A8 8 0 014.25 15.5h2.015a.75.75 0 110 1.5H2.75a.75.75 0 01-.75-.75v-3.515a.75.75 0 111.5 0v2.326l1.178-1.324z"
      clipRule="evenodd"
    />
  </svg>
);

function GameList({ games }) {
  if (!games || games.length === 0) {
    return (
      <div className="bg-gray-800 bg-opacity-70 rounded-lg p-6 shadow-md mt-4 text-center">
        <p className="text-gray-300 text-sm">No games recorded in this slot yet.</p>
      </div>
    );
  }

  const validGames = games.filter(game => Array.isArray(game.players) && game.players.length > 0);
  if (validGames.length === 0) {
     return (
      <div className="bg-gray-800 bg-opacity-70 rounded-lg p-6 shadow-md mt-4 text-center">
        <p className="text-gray-300 text-sm">No valid games with players found.</p>
      </div>
    );
  }

  const allPlayerNames = [...new Set(validGames.flatMap(game => game.players.map(player => player.name)))];
  allPlayerNames.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())); // Case-insensitive sort

  const playerTotals = {};
  allPlayerNames.forEach(name => (playerTotals[name] = 0));

  validGames.forEach(game => {
    if (game.endedAt) {
        game.players.forEach(player => {
            if (playerTotals.hasOwnProperty(player.name)) {
                 playerTotals[player.name] += (player.score || 0);
            }
        });
    }
  });
  
  const activeGame = validGames.find(game => !game.endedAt);
  const completedGames = validGames.filter(game => game.endedAt).sort((a, b) => b.gameNumber - a.gameNumber);

  return (
    <div className="bg-gray-800 bg-opacity-80 rounded-lg shadow-lg mt-4 overflow-hidden">
      <h3 className="text-lg sm:text-xl font-semibold text-white px-3 pt-3 sm:px-4 sm:pt-4 border-b border-gray-700 pb-3">
        {activeGame ? 'Current & Past Games' : 'Past Games History'}
      </h3>
      
      {activeGame && (
         <div className="px-3 sm:px-4 py-3 mb-2 bg-gray-700 bg-opacity-60"> {/* Slightly more opacity */}
            <p className="text-sm text-purple-300 font-semibold flex items-center">
                Game {activeGame.gameNumber} (Active) 
                {activeGame.isRotationGame && <span className="ml-2 inline-flex items-center"><RotationIcon /></span>}
            </p>
            <p className="text-xs text-gray-300 mt-1 break-words">
                Players: {activeGame.players.map(p => `${p.name} [${p.score === undefined ? 0 : p.score}]`).join(', ')}
            </p>
         </div>
      )}

      {(completedGames.length === 0 && !activeGame) && (
         <p className="text-gray-400 text-center text-sm p-4">No completed games in this slot yet.</p>
      )}

      {(completedGames.length > 0 || (activeGame && allPlayerNames.length > 0)) && (
        <div className="overflow-x-auto custom-scrollbar-thin">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700 bg-opacity-70 sticky top-0 z-10">
              <tr>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[100px] sm:min-w-[110px] sticky left-0 z-20 bg-gray-700" // Simplified bg, Tailwind handles opacity from parent if needed
                >
                  Game Info
                </th>
                {allPlayerNames.map((playerName) => (
                  <th
                    key={playerName}
                    scope="col"
                    className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[90px] sm:min-w-[100px] truncate"
                    title={playerName}
                  >
                   <span className="block w-full truncate">{playerName}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-600">
              {completedGames.map((game) => {
                const isRotation = !!game.isRotationGame;
                // Using Tailwind's opacity classes directly for tr background is cleaner
                const rowBg = isRotation ? 'bg-purple-900/60 hover:bg-purple-900/80' : 'bg-gray-800/60 hover:bg-gray-800/80'; // e.g. bg-opacity-60

                // For sticky cell, Tailwind classes are better
                const stickyCellBg = isRotation ? 'bg-purple-900/70' : 'bg-gray-800/85';

                return (
                  <tr
                    key={game.id || game.gameNumber} // Ensure a unique key
                    className={`${rowBg} transition-colors duration-150 ease-in-out`}
                  >
                    <td
                      className={`px-3 py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-white sticky left-0 z-10 ${stickyCellBg}`}
                    >
                      <div className="flex flex-col">
                          <span className="font-semibold">G{game.gameNumber}</span>
                          {game.winnerPlayerName && (
                          <span className="font-normal text-[11px] sm:text-xs mt-0.5 text-green-300 truncate" title={`Winner: ${game.winnerPlayerName}`}>
                              W: {game.winnerPlayerName}
                          </span>
                          )}
                          {isRotation && (
                          <span className="font-normal text-[11px] sm:text-xs mt-0.5 text-yellow-300 flex items-center">
                              <RotationIcon /> Rotation
                          </span>
                          )}
                      </div>
                    </td>
                    {allPlayerNames.map((playerName) => {
                      const playerInGame = game.players.find(p => p.name === playerName);
                      const score = playerInGame ? playerInGame.score : null;
                      let displayScore;
                      let cellClasses = "text-gray-200";

                      if (playerInGame && typeof score === 'number') {
                        displayScore = score > 0 ? `+${score}` : score.toString();
                        if (playerInGame.name === game.winnerPlayerName) cellClasses = 'text-green-400 font-semibold';
                        else if (score < 0) cellClasses = 'text-red-400 font-semibold';
                        else if (score === 0 && playerInGame.name !== game.winnerPlayerName) cellClasses = 'text-gray-200'; // Neutral for 0 score non-winner
                      } else {
                        displayScore = '-';
                        cellClasses = 'text-gray-500'; // Dim for players not in game
                      }
                      return (
                        <td
                          key={`${game.id || game.gameNumber}-${playerName}`}
                          className={`px-3 py-3 whitespace-nowrap text-xs sm:text-sm text-center ${cellClasses}`}
                        >
                          {displayScore}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            {completedGames.length > 0 && allPlayerNames.length > 0 && (
              <tfoot className="bg-gray-700 bg-opacity-90 border-t-2 border-purple-500 sticky bottom-0 z-10">
                <tr>
                  <th
                    scope="row"
                    className="px-3 py-3 text-left text-sm sm:text-base font-semibold text-white uppercase sticky left-0 z-20 bg-gray-700 bg-opacity-95" // Ensure bg is opaque enough
                  >
                    Total
                  </th>
                  {allPlayerNames.map((playerName) => {
                    const total = playerTotals[playerName];
                    const totalClasses = total > 0 ? 'text-green-400' : total < 0 ? 'text-red-400' : 'text-gray-100';
                    return (
                      <td
                        key={`total-${playerName}`}
                        className={`px-3 py-3 whitespace-nowrap text-sm sm:text-base font-semibold text-center ${totalClasses}`}
                      >
                        {total > 0 && total !== 0 ? `+${total}` : total}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

export default GameList;