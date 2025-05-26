// src/components/GameList.js
import React from 'react';

const RotationIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline-block mr-1 align-middle text-yellow-300"
  >
    <path
      fillRule="evenodd"
      d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903-1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V.375a.75.75 0 0 0-1.5 0v3.183l-1.903-1.903a9 9 0 0 0-15.002 4.134.75.75 0 1 0 1.48.217Zm14.245 4.932a7.5 7.5 0 0 1-12.548 3.364l-1.903 1.903h3.183a.75.75 0 0 0 0-1.5H.375a.75.75 0 0 0-.75.75v4.83a.75.75 0 0 0 1.5 0v-3.183l1.903 1.903a9 9 0 0 0 15.002-4.134.75.75 0 0 0-1.48-.217Z"
      clipRule="evenodd"
    />
  </svg>
);

function GameList({ games }) {
  if (!games || games.length === 0) {
    return (
      <div className="bg-gray-800 bg-opacity-70 rounded-lg p-4 shadow-md mt-4">
        <p className="text-gray-300 text-center text-sm">No games recorded in this slot yet.</p>
      </div>
    );
  }

  const validGames = games.filter(game => Array.isArray(game.players));
  const allPlayerNames = [...new Set(validGames.flatMap(game => game.players.map(player => player.name)))];
  allPlayerNames.sort();

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
  const completedGames = validGames.filter(game => game.endedAt).sort((a, b) => b.gameNumber - a.gameNumber); // Most recent first

  return (
    <div className="bg-gray-800 bg-opacity-80 rounded-lg shadow-lg mt-4 overflow-hidden">
      <h3 className="text-lg sm:text-xl font-semibold text-white mb-0 px-3 pt-3 sm:px-4 sm:pt-4 border-b border-gray-700 pb-3">
        {activeGame ? 'Current & Past Games' : 'Past Games History'}
      </h3>
      
      {activeGame && (
         <div className="px-3 sm:px-4 py-3 mb-2 bg-gray-700 bg-opacity-50">
            <p className="text-sm text-purple-300 font-semibold flex items-center">
                Game {activeGame.gameNumber} (Active) 
                {activeGame.isRotationGame && <span className="ml-2"><RotationIcon /></span>}
            </p>
            <p className="text-xs text-gray-300 mt-1">
                Players: {activeGame.players.map(p => `${p.name} [${p.score === undefined ? 0 : p.score}]`).join(', ')}
            </p>
         </div>
      )}

      {(completedGames.length === 0 && !activeGame) && (
         <p className="text-gray-400 text-center text-sm p-4">No completed games in this slot yet.</p>
      )}

      {(completedGames.length > 0 || (activeGame && allPlayerNames.length > 0)) && (
        <div className="overflow-x-auto custom-scrollbar-thin"> {/* Added custom-scrollbar-thin class */}
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700 bg-opacity-70 sticky top-0 z-10">
              <tr>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[90px] sm:min-w-[100px] sticky left-0 z-20 bg-gray-700 bg-opacity-90" // Increased min-width
                >
                  Game Info
                </th>
                {allPlayerNames.map((playerName) => (
                  <th
                    key={playerName}
                    scope="col"
                    className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[90px] sm:min-w-[100px]" // Increased min-width, removed truncate
                    title={playerName}
                  >
                    {playerName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-600">
              {completedGames.map((game) => {
                const isRotation = !!game.isRotationGame;
                const rowBgBase = isRotation ? 'bg-purple-900' : 'bg-gray-800';
                const rowBgOpacity = 'bg-opacity-50 hover:bg-opacity-70'; // Enhanced opacity
                const stickyCellStyle = { 
                    backgroundColor: isRotation ? 'rgba(67, 56, 202, 0.8)' : 'rgba(31, 41, 55, 0.85)', // Adjusted purple and gray
                 };

                return (
                  <tr
                    key={game.id}
                    className={`${rowBgBase} ${rowBgOpacity} transition-colors duration-150 ease-in-out`}
                  >
                    <td
                      className="px-3 py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-white sticky left-0 z-10"
                      style={stickyCellStyle}
                    >
                      <div className="flex flex-col">
                          <span className="font-semibold">G{game.gameNumber}</span>
                          {game.winnerPlayerName && (
                          <span className="font-normal text-[11px] sm:text-xs mt-0.5 text-green-300" title={`Winner: ${game.winnerPlayerName}`}>
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
                        else if (score === 0 && playerInGame.name !== game.winnerPlayerName) cellClasses = 'text-gray-200';
                      } else {
                        displayScore = '-';
                        cellClasses = 'text-gray-500';
                      }
                      return (
                        <td
                          key={`${game.id}-${playerName}`}
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
                    className="px-3 py-3 text-left text-sm sm:text-base font-semibold text-white uppercase sticky left-0 z-20 bg-gray-700 bg-opacity-95"
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
                        {total > 0 ? `+${total}` : total}
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