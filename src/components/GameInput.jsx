// src/components/GameInput.js
import React from 'react';

function GameInput({
  currentGamePlayers,
  handleUpdatePlayerScore,
  handleEndGame,
  handleStartLocalGame, // Renamed from handleCreateNewGame
  handleCancelGame,
  games, // DB games
  masterPlayerList,
  onTogglePlayerForNextGame,
  onToggleRotationForCurrentGame,
  pendingGame, // New prop: { gameNumber, createdAt, isRotationGame, isLocallyActive }
  activeFirestoreGameId // New prop: ID of an active game from Firestore, if any
}) {
  const isLocalGameActive = !!pendingGame?.isLocallyActive;
  const firestoreActiveGame = games.find(g => !g.endedAt && g.id === activeFirestoreGameId);
  const isGameEffectivelyActive = isLocalGameActive || !!firestoreActiveGame;

  // Determine the game object to use for display and logic (local takes precedence)
  let gameForUI;
  if (isLocalGameActive) {
    gameForUI = {
      id: 'local', // Special ID for local game
      gameNumber: pendingGame.gameNumber,
      isRotationGame: pendingGame.isRotationGame,
      // players are from currentGamePlayers prop
    };
  } else if (firestoreActiveGame) {
    gameForUI = firestoreActiveGame;
  }

  const isCurrentUIGameRotation = gameForUI ? !!gameForUI.isRotationGame : false;
  
  // Player and score logic primarily uses currentGamePlayers prop which App.js manages
  const playersInCurrentInteraction = currentGamePlayers;

  const nonZeroScoreEnteredCount = playersInCurrentInteraction.filter(p => p.score !== 0).length;
  const canIdentifyWinnerForInputDisable = playersInCurrentInteraction.length > 1 && nonZeroScoreEnteredCount === playersInCurrentInteraction.length - 1;
  
  const potentialWinners = playersInCurrentInteraction.filter(p => p.score === 0);
  const canEndGame = isGameEffectivelyActive && // Must be an active game (local or DB)
                     playersInCurrentInteraction.length >= 2 && 
                     potentialWinners.length === 1 &&
                     nonZeroScoreEnteredCount === (playersInCurrentInteraction.length - 1);

  // Determine game number for "Setup New Game" title
  let nextGameNumberDisplay = 1;
  if (games.length > 0) {
    nextGameNumberDisplay = games.reduce((max, g) => Math.max(max, g.gameNumber), 0) + 1;
  }


  return (
    <div className="bg-gray-800 bg-opacity-70 rounded-lg p-3 sm:p-4 shadow-md mb-4">
      <h3 className="text-lg sm:text-xl font-semibold text-white mb-3">
        {isGameEffectivelyActive && gameForUI 
          ? `Game ${gameForUI.gameNumber}` 
          : `Setup New Game ${nextGameNumberDisplay}`}
      </h3>

      {isGameEffectivelyActive && gameForUI ? (
        // Active Game UI (Local or DB)
        <>
          <p className="text-xs sm:text-sm text-gray-300 mb-2">
            Enter points lost by each player. Winner must have 0 points.
          </p>
          <div className="space-y-2 sm:space-y-3 mb-3">
            {playersInCurrentInteraction.map((player) => {
              const isDesignatedWinnerForInput = canIdentifyWinnerForInputDisable && player.score === 0;
              const isLikelyWinnerForHighlight = player.score === 0 && canEndGame && potentialWinners[0]?.name === player.name;
              return (
                <div key={player.name} className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
                  <label htmlFor={`score-${player.name}`} className="w-full sm:w-2/5 text-gray-200 text-sm pr-1">
                    {player.name}:
                  </label>
                  <input
                    id={`score-${player.name}`}
                    type="number"
                    pattern="\d*" 
                    inputMode="numeric"
                    value={player.score.toString()} // Scores come from currentGamePlayers
                    onChange={(e) => {
                      const value = e.target.value;
                      handleUpdatePlayerScore(player.name, value === '' ? 0 : parseInt(value, 10));
                    }}
                    disabled={isDesignatedWinnerForInput}
                    className={`w-full sm:flex-grow p-2 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-400 text-sm
                                ${isLikelyWinnerForHighlight ? 'ring-2 ring-green-500' : ''}
                                ${isDesignatedWinnerForInput ? 'bg-gray-600 cursor-not-allowed opacity-70' : ''}`}
                    placeholder="Points Lost"
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center mt-3 mb-4">
            <input
              type="checkbox"
              id="isRotationGame"
              checked={isCurrentUIGameRotation}
              onChange={(e) => onToggleRotationForCurrentGame(e.target.checked)}
              className="form-checkbox h-4 w-4 text-purple-600 rounded bg-gray-600 border-gray-500 cursor-pointer focus:ring-purple-500 focus:ring-offset-gray-800"
            />
            <label htmlFor="isRotationGame" className="ml-2 text-gray-200 text-sm cursor-pointer">
              Rotation Game
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3">
            <button
              onClick={handleEndGame}
              className="w-full sm:flex-1 px-3 py-2.5 text-sm bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-md shadow-md transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:bg-yellow-700 disabled:text-gray-700"
              disabled={!canEndGame}
            >
              End Game {gameForUI.gameNumber}
            </button>
            <button
              onClick={handleCancelGame}
              className="w-full sm:flex-1 px-3 py-2.5 text-sm bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md shadow-md transition-transform hover:scale-105"
            >
              Cancel Game
            </button>
          </div>
        </>
      ) : (
        // Setup New Game UI
        <>
          <p className="text-xs sm:text-sm text-gray-300 mb-2">
            Select players for Game {nextGameNumberDisplay}:
          </p>

          {masterPlayerList.length === 0 ? (
             <p className="text-yellow-400 text-xs text-center py-2">
              Add players via "Manage Roster" first.
            </p>
          ) : (
            <div className="grid grid-cols-2 xs:grid-cols-3 gap-2 mb-3">
              {masterPlayerList.map(masterPlayer => {
                // currentGamePlayers represents the selected players for the new game setup
                const isSelected = playersInCurrentInteraction.some(p => p.name === masterPlayer.name);
                return (
                  <button
                    key={masterPlayer.id}
                    onClick={() => onTogglePlayerForNextGame(masterPlayer.name)}
                    className={`
                      flex items-center justify-center text-center p-2.5 rounded-md shadow-sm transition-all duration-150 ease-in-out text-xs sm:text-sm 
                      ${isSelected
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-1 ring-indigo-400'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}
                    `}
                    title={masterPlayer.name}
                  >
                    <span className="w-full overflow-hidden text-ellipsis whitespace-nowrap">{masterPlayer.name}</span>
                    {isSelected && (
                      <svg className="ml-1 h-3 w-3 sm:h-4 sm:w-4 text-green-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {playersInCurrentInteraction.length > 0 && (
            <div className="text-gray-400 text-xs mb-3 break-words">
              <span className="font-semibold text-gray-300">Selected:</span> {playersInCurrentInteraction.map(p => p.name).join(', ')}
            </div>
          )}
          <button
            onClick={handleStartLocalGame} // Use the new handler
            className="w-full px-3 py-2.5 text-sm bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md shadow-md transition-transform hover:scale-105 disabled:bg-gray-500 disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:scale-100"
            disabled={playersInCurrentInteraction.length < 2 || masterPlayerList.length === 0 || isGameEffectivelyActive /* Cannot start if a game is already active */}
          >
            Start New Game
          </button>
        </>
      )}
    </div>
  );
}
export default GameInput;